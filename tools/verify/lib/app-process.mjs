import assert from 'node:assert/strict'
import net from 'node:net'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { runProcess } from './proc.mjs'

export async function powershell(script) {
  const result = await runProcess(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', script],
    { timeoutMs: 15000 }
  )
  if (result.code !== 0)
    throw new Error(`Process inspection failed: ${result.stderr}`)
  return result.stdout.trim()
}

export async function processInfo(pid) {
  assert(Number.isSafeInteger(pid) && pid > 0, 'Invalid process ID')
  const result = await powershell(
    `$p = Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}'; if ($p) { [pscustomobject]@{pid=$p.ProcessId; parent=$p.ParentProcessId; exe=$p.ExecutablePath; created=$p.CreationDate.ToUniversalTime().ToString('o')} | ConvertTo-Json -Compress }`
  )
  return result ? JSON.parse(result) : null
}

export async function profileProcesses(name) {
  assert(/^[a-z0-9][a-z0-9-]{0,31}$/.test(name))
  const output = await powershell(
    `@(Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match '(?:^|\\s)--go-verify-profile=${name}(?:\\s|$)' } | ForEach-Object { [pscustomobject]@{pid=$_.ProcessId; parent=$_.ParentProcessId; exe=$_.ExecutablePath; created=$_.CreationDate.ToUniversalTime().ToString('o')} }) | ConvertTo-Json -Compress`
  )
  return output ? [JSON.parse(output)].flat() : []
}

export function sameProcess(expected, actual) {
  if (!expected || !actual || !expected.exe || !actual.exe) return false
  return (
    expected.pid === actual.pid &&
    expected.created === actual.created &&
    path.resolve(expected.exe).toLowerCase() ===
      path.resolve(actual.exe).toLowerCase()
  )
}

export async function stopOwnedProcess(identity) {
  const actual = await processInfo(identity.pid)
  if (!actual) return
  assert(
    sameProcess(identity, actual),
    'Refusing to terminate a reused or unverified process ID'
  )
  const result = await runProcess(
    'taskkill.exe',
    ['/PID', String(identity.pid), '/T', '/F'],
    { timeoutMs: 15000 }
  )
  if (result.code !== 0 && (await processInfo(identity.pid)))
    throw new Error(`Could not stop owned process: ${result.stderr}`)
  assert(
    !sameProcess(identity, await processInfo(identity.pid)),
    'Owned process survived cleanup'
  )
}

export async function freePort() {
  const server = net.createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const port = server.address().port
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  )
  return port
}

export async function assertListenerOwned(port, identity) {
  assert(Number.isSafeInteger(port) && port > 0, 'Invalid CDP port')
  const output = await powershell(
    `Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction Stop | Select-Object -ExpandProperty OwningProcess -Unique | ConvertTo-Json -Compress`
  )
  const owners = [JSON.parse(output)].flat()
  for (const owner of owners) await assertDescendant(owner, identity)
}

async function assertDescendant(pid, identity) {
  for (let depth = 0; depth < 12; depth++) {
    const actual = await processInfo(pid)
    assert(actual, 'CDP listener owner disappeared')
    if (sameProcess(identity, actual)) return
    pid = actual.parent
    if (!pid) break
  }
  throw new Error('CDP listener does not belong to the launched app')
}

export async function waitUntil(fn, message, timeoutMs = 30000, signal) {
  const deadline = Date.now() + timeoutMs
  let lastError
  do {
    signal?.throwIfAborted()
    try {
      const value = await fn()
      if (value) return value
    } catch (error) {
      lastError = error
    }
    await delay(150)
  } while (Date.now() < deadline)
  throw new Error(`${message}${lastError ? `: ${lastError.message}` : ''}`)
}

export async function bounded(promise, timeoutMs, message) {
  let timer
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}
