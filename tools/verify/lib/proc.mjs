import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, delimiter, join } from 'node:path'

let toolchainBin
function childEnvironment(env) {
  const result = { ...(env ?? process.env) }
  const cargoBin = join(homedir(), '.cargo', 'bin')
  if (!toolchainBin && process.platform === 'win32') {
    const rustup = spawnSync(join(cargoBin, 'rustup.exe'), ['which', 'cargo'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 10000,
    })
    toolchainBin =
      rustup.status === 0 ? dirname(rustup.stdout.trim()) : cargoBin
  }
  const pathKey = Object.prototype.hasOwnProperty.call(result, 'Path')
    ? 'Path'
    : 'PATH'
  const currentPath = (result[pathKey] ?? '').split(delimiter).filter(Boolean)
  if (!currentPath.includes(cargoBin))
    result[pathKey] = [cargoBin, ...currentPath].join(delimiter)
  if (toolchainBin)
    result[pathKey] = [toolchainBin, result[pathKey]].join(delimiter)
  if (pathKey === 'Path') delete result.PATH
  return result
}

function killTree(child) {
  if (child.exitCode !== null) return
  if (process.platform === 'win32') {
    spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore',
    })
  } else {
    try {
      process.kill(-child.pid, 'SIGTERM')
    } catch {
      child.kill('SIGTERM')
    }
  }
}

export function runProcess(
  command,
  args = [],
  { cwd, env, timeoutMs = 120000, logPath } = {}
) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now()
    let child
    try {
      if (logPath) {
        mkdirSync(dirname(logPath), { recursive: true })
        writeFileSync(logPath, '')
      }
      child = spawn(command, args, {
        cwd,
        env: childEnvironment(env),
        shell: false,
        windowsHide: true,
        detached: process.platform !== 'win32',
      })
    } catch (error) {
      reject(error)
      return
    }
    const stdout = []
    const stderr = []
    let timedOut = false
    let settled = false
    let killTimer
    let logError
    const logChunk = (chunk) => {
      if (!logPath || logError) return
      try {
        appendFileSync(logPath, chunk)
      } catch (error) {
        logError = error
        killTree(child)
      }
    }
    const finish = async (error, code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      clearTimeout(killTimer)
      if (error || logError) {
        reject(error ?? logError)
        return
      }
      const result = {
        code: timedOut ? null : (code ?? 1),
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
        durationMs: Date.now() - startedAt,
        timedOut,
      }
      resolve(result)
    }
    const timer = setTimeout(() => {
      timedOut = true
      killTree(child)
      killTimer = setTimeout(() => {
        if (!settled) {
          try {
            child.kill('SIGKILL')
          } catch {}
          child.stdout?.destroy()
          child.stderr?.destroy()
          child.stdin?.destroy()
          child.unref()
          void finish(null, null)
        }
      }, 2000)
    }, timeoutMs)
    child.stdout?.on('data', (chunk) => {
      stdout.push(chunk)
      logChunk(chunk)
    })
    child.stderr?.on('data', (chunk) => {
      stderr.push(chunk)
      logChunk(chunk)
    })
    child.once('error', (error) => {
      void finish(error)
    })
    child.once('close', (code) => {
      void finish(null, code)
    })
  })
}
