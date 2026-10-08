import { execFile } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdir, rename, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, sep } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

function safeRelativePath(relativePath) {
  if (
    typeof relativePath !== 'string' ||
    !relativePath ||
    isAbsolute(relativePath)
  ) {
    throw new Error('Evidence paths must be relative.')
  }
  const normalized = relativePath.replaceAll('\\', '/')
  if (normalized.split('/').includes('..') || normalized.startsWith('/')) {
    throw new Error('Evidence paths may not escape the run directory.')
  }
  return normalized
}

async function uniqueRunDir(root, command) {
  const base = join(root, '.verify')
  await mkdir(base, { recursive: true })
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const name = `${new Date().toISOString().replaceAll(/[-:.TZ]/g, '')}-${command.replace(/[^a-z0-9-]/gi, '-')}-${process.pid}-${randomBytes(4).toString('hex')}`
    const dir = join(base, name)
    try {
      await mkdir(dir)
      return dir
    } catch (error) {
      if (error.code !== 'EEXIST') throw error
    }
  }
  throw new Error('Could not allocate a unique evidence directory.')
}

async function gitValue(root, args) {
  try {
    const result = await execFileAsync('git', args, {
      cwd: root,
      windowsHide: true,
    })
    return result.stdout.trim()
  } catch {
    return null
  }
}

function errorDetails(error) {
  return {
    name: error?.name ?? 'Error',
    message: error?.message ?? String(error),
    code: error?.code,
    stack: error?.stack,
  }
}

export async function createEvidence(root, command) {
  const dir = await uniqueRunDir(root, command)
  const startedAt = Date.now()
  const report = {
    schema: 1,
    command,
    startedAt: new Date(startedAt).toISOString(),
    status: 'running',
    exitCode: null,
    git: {
      sha: await gitValue(root, ['rev-parse', 'HEAD']),
      branch: await gitValue(root, ['branch', '--show-current']),
    },
    env: {
      ci: process.env.CI === 'true',
      platform: process.platform,
      node: process.version,
    },
    durationMs: 0,
    subject: {},
    metrics: {},
    checks: [],
    trace: { status: 'not-requested' },
  }

  async function write(relativePath, content) {
    const target = join(dir, safeRelativePath(relativePath))
    const payload = Buffer.isBuffer(content)
      ? content
      : typeof content === 'object'
        ? `${JSON.stringify(content, null, 2)}\n`
        : String(content)
    await mkdir(dirname(target), { recursive: true })
    const temp = `${target}.${process.pid}.tmp`
    await writeFile(temp, payload)
    await rename(temp, target)
    return relative(dir, target).split(sep).join('/')
  }

  async function check(id, fn) {
    console.log(`[verify] ${id}`)
    const checkStarted = Date.now()
    const item = { id, status: 'running', durationMs: 0 }
    report.checks.push(item)
    try {
      const result = await fn()
      item.status = 'passed'
      item.durationMs = Date.now() - checkStarted
      if (result && typeof result === 'object') {
        if ('message' in result) item.message = result.message
        if ('data' in result) item.data = result.data
        if ('evidence' in result) item.evidence = result.evidence
      }
      return result
    } catch (error) {
      item.status = 'failed'
      item.durationMs = Date.now() - checkStarted
      if (error?.evidence !== undefined) item.evidence = error.evidence
      item.error = errorDetails(error)
      console.error(`[verify] FAIL ${id}: ${item.error.message}`)
      throw error
    }
  }

  async function checkpoint() {
    report.durationMs = Date.now() - startedAt
    await write('report.json', report)
    const latest = join(root, '.verify', 'latest.json')
    const temp = `${latest}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`
    await writeFile(
      temp,
      `${JSON.stringify({ ...report, dir: relative(root, dir).split(sep).join('/') }, null, 2)}\n`
    )
    await rename(temp, latest)
  }

  async function finish(exitCode) {
    report.exitCode = exitCode
    report.status =
      {
        0: 'passed',
        1: 'failed',
        2: 'error',
        3: 'attention',
        64: 'usage-error',
      }[exitCode] ?? 'error'
    await checkpoint()
    console.log(
      `[verify] ${report.status} (exit ${exitCode}) - ${join(dir, 'report.json')}`
    )
    return report
  }

  await checkpoint()
  return { dir, report, check, write, checkpoint, finish }
}

export { safeRelativePath }
