import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { readOptional } from '../lib/app-profile.mjs'
import { runProcess } from '../lib/proc.mjs'

function installedExe(root, options) {
  return resolve(
    options.exe ??
      process.env.DESKTOP_INSTALLED_EXE ??
      join(root, 'desktop', 'Genshin Optimizer Local.exe')
  )
}

function quotePowerShell(value) {
  return `'${value.replaceAll("'", "''")}'`
}

async function expectedVersion(root) {
  try {
    return JSON.parse(
      await readFile(join(root, 'src-tauri', 'tauri.conf.json'), 'utf8')
    ).version
  } catch {
    return null
  }
}

async function expectedDigest(root, exe) {
  const buildCandidates = [
    process.env.DESKTOP_BUILD_EXE && resolve(process.env.DESKTOP_BUILD_EXE),
    join(
      root,
      'src-tauri',
      'target',
      'release',
      'genshin-optimizer-desktop.exe'
    ),
  ].filter(
    (candidate) =>
      candidate && existsSync(candidate) && resolve(candidate) !== resolve(exe)
  )
  const expectedExe = buildCandidates[0]
  const expectedHashResult =
    expectedExe && existsSync(expectedExe)
      ? await runProcess(
          'powershell.exe',
          [
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            `(Get-FileHash -LiteralPath ${quotePowerShell(expectedExe)} -Algorithm SHA256).Hash`,
          ],
          { cwd: root, timeoutMs: 30000 }
        )
      : null
  return expectedHashResult?.code === 0
    ? expectedHashResult.stdout.trim()
    : process.env.DESKTOP_EXPECTED_SHA256
}

async function installedMetadata(root, exe, evidence) {
  const imageName = exe.split('\\').pop().replaceAll("'", "''")
  const ps = `$ErrorActionPreference='Stop'; $f=Get-Item -LiteralPath ${quotePowerShell(exe)}; $processes=@(Get-CimInstance Win32_Process -Filter "Name='${imageName}'" | Where-Object { $_.ExecutablePath -eq $f.FullName } | ForEach-Object { $creation=$_.CreationDate.ToUniversalTime(); [pscustomobject]@{ path=$_.ExecutablePath; creation=$creation.ToString('o'); afterWrite=($creation -gt $f.LastWriteTimeUtc); pid=$_.ProcessId } }); [pscustomobject]@{ path=$f.FullName; sha256=(Get-FileHash -LiteralPath $f.FullName -Algorithm SHA256).Hash; productVersion=$f.VersionInfo.ProductVersion; writeTime=$f.LastWriteTimeUtc.ToString('o'); processes=$processes } | ConvertTo-Json -Compress -Depth 4`
  const result = await runProcess(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', ps],
    {
      cwd: root,
      timeoutMs: 30000,
      logPath: join(evidence.dir, 'logs', 'installed.log'),
    }
  )
  if (result.code !== 0 || !result.stdout.trim())
    throw new Error(
      'Unable to inspect installed executable; see logs/installed.log'
    )
  return JSON.parse(result.stdout)
}

function runningProcesses(metadata) {
  return [metadata.processes ?? []].flat()
}

function matchesInstalledProcess(process, exe) {
  return (
    resolve(process.path ?? '') === resolve(exe) && process.afterWrite === true
  )
}

function installedChecks(exe, metadata, expectedHash, expectedProductVersion) {
  const processes = runningProcesses(metadata)
  return [
    [
      'installed-sha256',
      expectedHash &&
        metadata.sha256.toUpperCase() === expectedHash.toUpperCase(),
      { actual: metadata.sha256, expected: expectedHash ?? 'unavailable' },
    ],
    [
      'installed-product-version',
      metadata.productVersion?.split(/[+\s]/)[0] === expectedProductVersion,
      {
        actual: metadata.productVersion,
        expected: expectedProductVersion ?? 'unavailable',
      },
    ],
    [
      'installed-process-identity',
      processes.length > 0 &&
        processes.every((process) => matchesInstalledProcess(process, exe)),
      {
        count: processes.length,
        paths: processes.map((process) => process.path),
        creation: processes.map((process) => process.creation),
      },
    ],
  ]
}

async function recordStorageBaseline(root, options, evidence) {
  const config = JSON.parse(
    await readFile(join(root, 'src-tauri/tauri.conf.json'), 'utf8')
  )
  const storage = await readOptional(
    join(
      process.env.LOCALAPPDATA,
      config.identifier,
      'storage/localStorage.json'
    )
  )
  const storageHash =
    storage === null ? null : createHash('sha256').update(storage).digest('hex')
  evidence.report.subject.realStorageSha256 = storageHash
  if (options.baseline) {
    const baseline = JSON.parse(
      await readFile(resolve(options.baseline), 'utf8')
    )
    assert(
      Object.hasOwn(baseline.subject ?? {}, 'realStorageSha256'),
      'Baseline has no real storage digest'
    )
    await evidence.check('installed-user-storage', () => {
      if (storageHash !== baseline.subject.realStorageSha256)
        throw Object.assign(
          new Error(
            'Real account storage changed since the installation baseline'
          ),
          { exitCode: 1 }
        )
      return { message: 'Real account storage matches the pre-install digest' }
    })
  }
}

export async function run({ root, options, evidence }) {
  await recordStorageBaseline(root, options, evidence)
  const exe = installedExe(root, options)
  if (!existsSync(exe)) {
    await evidence.write('installed.json', { exe, available: false })
    return 2
  }
  const expectedHash = await expectedDigest(root, exe)
  const metadata = await installedMetadata(root, exe, evidence)
  const expectedProductVersion = await expectedVersion(root)
  let checks = installedChecks(
    exe,
    metadata,
    expectedHash,
    expectedProductVersion
  )
  if (!runningProcesses(metadata).length) {
    await evidence.check('installed-launch-state', () => ({
      message: options.runtime
        ? 'App is closed; verifying an isolated launch next'
        : 'App is closed; use --runtime or launch the installed app',
    }))
    if (!options.runtime) return 2
    checks = checks.filter(([id]) => id !== 'installed-process-identity')
  }
  await evidence.write('installed.json', {
    exe,
    metadata,
    expectedHash,
    expectedProductVersion,
  })
  let failed = false
  for (const [id, passed, data] of checks) {
    await evidence
      .check(id, () => {
        if (!passed) {
          failed = true
          throw new Error(`${id} failed`)
        }
        return { message: id, data }
      })
      .catch(() => {})
  }
  if (failed) return 1
  if (options.runtime) {
    const { runApp } = await import('../lib/app.mjs')
    return runApp({
      root,
      options: { ...options, exe },
      args: ['smoke'],
      evidence,
    })
  }
  return 0
}
