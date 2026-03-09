import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

const rootDir = process.cwd()
const desktopDir = join(rootDir, 'desktop')
const tauriConfigPath = join(rootDir, 'src-tauri', 'tauri.conf.json')

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })

    child.on('exit', (code, signal) => {
      if (signal) process.kill(process.pid, signal)
      if (code === 0) return resolve()
      reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`))
    })

    child.on('error', reject)
  })
}

function copyIfExists(from, to) {
  if (!existsSync(from)) return
  const stat = lstatSync(from)
  cpSync(from, to, { force: true, recursive: stat.isDirectory() })
  console.log(`Copied ${from} -> ${to}`)
}

function formatCopyTarget(path) {
  return path.replaceAll(rootDir, '.')
}

function isWindowsFileLockError(error) {
  return (
    process.platform === 'win32' &&
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error.code === 'EPERM' || error.code === 'EBUSY')
  )
}

function copyWithWarning(from, to, warnings) {
  try {
    copyIfExists(from, to)
  } catch (error) {
    if (!isWindowsFileLockError(error)) throw error
    warnings.push(
      `Could not update ${formatCopyTarget(
        to
      )} because Windows still has it open. Close the running desktop app and rerun the build, or launch the fresh binary from ${formatCopyTarget(
        from
      )}.`
    )
  }
}

async function main() {
  await run('node', ['.yarn/releases/yarn-3.4.1.cjs', 'tauri', 'build'])

  const tauriConfig = JSON.parse(readFileSync(tauriConfigPath, 'utf8'))
  const productName = tauriConfig.productName
  const version = tauriConfig.version
  const releaseDir = join(rootDir, 'src-tauri', 'target', 'release')
  const warnings = []

  mkdirSync(desktopDir, { recursive: true })

  copyWithWarning(
    join(releaseDir, 'genshin-optimizer-desktop.exe'),
    join(desktopDir, `${productName}.exe`),
    warnings
  )
  const desktopResourcesDir = join(desktopDir, 'resources')
  try {
    rmSync(desktopResourcesDir, { recursive: true, force: true })
    copyIfExists(join(releaseDir, 'resources'), desktopResourcesDir)
  } catch (error) {
    if (!isWindowsFileLockError(error)) throw error
    warnings.push(
      `Could not refresh ${formatCopyTarget(
        desktopResourcesDir
      )} because the launcher is still using those files.`
    )
  }
  copyWithWarning(
    join(
      releaseDir,
      'bundle',
      'nsis',
      `${productName}_${version}_x64-setup.exe`
    ),
    join(desktopDir, `${productName} Setup.exe`),
    warnings
  )
  copyWithWarning(
    join(
      releaseDir,
      'bundle',
      'msi',
      `${productName}_${version}_x64_en-US.msi`
    ),
    join(desktopDir, `${productName}.msi`),
    warnings
  )

  if (warnings.length) {
    console.warn('\nDesktop build completed with copy warnings:')
    for (const warning of warnings) console.warn(`- ${warning}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
