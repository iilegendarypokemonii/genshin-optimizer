import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import {
  processInfo,
  profileProcesses,
  sameProcess,
  stopOwnedProcess,
} from './app-process.mjs'

export function validateProfileName(name) {
  assert(
    typeof name === 'string' && /^[a-z0-9][a-z0-9-]{0,31}$/.test(name),
    'Invalid verification profile name'
  )
  return name
}

export function profilePath(
  identifier,
  name,
  localAppData = process.env.LOCALAPPDATA
) {
  validateProfileName(name)
  assert(/^[a-zA-Z0-9.-]+$/.test(identifier), 'Invalid app identifier')
  assert(
    localAppData && path.isAbsolute(localAppData),
    'LOCALAPPDATA must be an absolute path'
  )
  return path.join(path.resolve(localAppData), `${identifier}.verify-${name}`)
}

export async function assertDirectory(target, base) {
  assert(
    path.dirname(path.resolve(target)) === path.resolve(base),
    'Profile must be directly under LOCALAPPDATA'
  )
  const stat = await fs.lstat(target).catch((error) => {
    if (error.code !== 'ENOENT') throw error
    return null
  })
  if (!stat) return
  assert(
    stat.isDirectory() && !stat.isSymbolicLink(),
    'Profile/lock must be a real directory, not a link'
  )
  const actual = await fs.realpath(target)
  const parent = await fs.realpath(base)
  assert(
    path.dirname(actual).toLowerCase() === parent.toLowerCase(),
    'Resolved profile escapes LOCALAPPDATA'
  )
}

export async function removeProfile(target, base) {
  await assertDirectory(target, base)
  await fs.rm(target, {
    recursive: true,
    force: true,
    maxRetries: 20,
    retryDelay: 150,
  })
}

export async function recoverProfile(
  identifier,
  name,
  localAppData = process.env.LOCALAPPDATA
) {
  const target = profilePath(identifier, name, localAppData)
  const base = path.dirname(target)
  const lockPath = `${target}.lock`
  const recovery = `${lockPath}.recover`
  await assertDirectory(lockPath, base)
  await fs.mkdir(recovery)
  try {
    const owner = JSON.parse(
      await fs.readFile(path.join(lockPath, 'owner.json'), 'utf8')
    )
    assert(
      !(await processInfo(owner.pid)),
      'Refusing recovery while the owning harness PID is live'
    )
    const bytes = await readOptional(path.join(lockPath, 'app.json'))
    const recorded = bytes ? JSON.parse(bytes) : null
    for (const running of await profileProcesses(name)) {
      assert(
        sameProcess(recorded, running),
        'Refusing recovery of an unverified profile process'
      )
      await stopOwnedProcess(recorded)
    }
    await removeProfile(target, base)
    await removeProfile(lockPath, base)
  } finally {
    await removeProfile(recovery, base)
  }
}

export async function claimProfile(
  identifier,
  name,
  localAppData = process.env.LOCALAPPDATA,
  recover = false
) {
  const target = profilePath(identifier, name, localAppData)
  const base = path.dirname(target)
  const lockPath = `${target}.lock`
  await assertDirectory(target, base)
  await assertDirectory(lockPath, base)
  if (recover) {
    const exists = await fs.stat(lockPath).catch(() => null)
    if (exists) await recoverProfile(identifier, name, localAppData)
  }
  await fs.mkdir(lockPath).catch((error) => {
    if (error.code === 'EEXIST')
      throw new Error(
        `Profile ${name} is locked by another or interrupted run: ${lockPath}`
      )
    throw error
  })
  const token = randomUUID()
  try {
    await fs.writeFile(
      path.join(lockPath, 'owner.json'),
      JSON.stringify({ pid: process.pid, token })
    )
    await removeProfile(target, base)
    await fs.mkdir(target)
  } catch (error) {
    await removeProfile(lockPath, base)
    throw error
  }
  return { target, base, lockPath, token }
}

export async function releaseProfile(claim, keepProfile) {
  await assertDirectory(claim.lockPath, claim.base)
  const owner = JSON.parse(
    await fs.readFile(path.join(claim.lockPath, 'owner.json'), 'utf8')
  )
  assert.equal(owner.token, claim.token, 'Profile lock ownership changed')
  if (!keepProfile) await removeProfile(claim.target, claim.base)
  await removeProfile(claim.lockPath, claim.base)
}

export async function readOptional(file) {
  try {
    return await fs.readFile(file)
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

export function sameStorage(before, after) {
  if (before === null || after === null) return before === after
  return before.equals(after)
}
