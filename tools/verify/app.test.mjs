import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { hasProtocolMarker, validAppUrl } from './lib/app.mjs'
import { sameProcess, waitUntil } from './lib/app-process.mjs'
import {
  claimProfile,
  profilePath,
  releaseProfile,
  sameStorage,
  validateProfileName,
} from './lib/app-profile.mjs'

const identifier = 'com.example.verification'

test('profiles reject traversal, broad names and relative roots', () => {
  for (const name of [
    '',
    '.',
    '..',
    '../escape',
    'a/b',
    'a\\b',
    'a space',
    '-bad',
    'UPPER',
    'under_score',
    'x'.repeat(33),
  ])
    assert.throws(() => validateProfileName(name))
  assert.equal(validateProfileName('a'.repeat(32)), 'a'.repeat(32))
  assert.throws(() => profilePath(identifier, 'okay', '../relative'))
})

test('profile locks protect concurrent runs; keep releases lock; next claim resets data', async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'verify-profile-'))
  try {
    const first = await claimProfile(identifier, 'test', base)
    await fs.writeFile(path.join(first.target, 'sentinel'), 'keep')
    await assert.rejects(claimProfile(identifier, 'test', base), /locked/)
    assert.equal(
      await fs.readFile(path.join(first.target, 'sentinel'), 'utf8'),
      'keep'
    )
    await releaseProfile(first, true)
    const second = await claimProfile(identifier, 'test', base)
    await assert.rejects(fs.stat(path.join(second.target, 'sentinel')), {
      code: 'ENOENT',
    })
    await releaseProfile(second, false)
    await assert.rejects(fs.stat(second.target), { code: 'ENOENT' })
  } finally {
    await fs.rm(base, { recursive: true, force: true })
  }
})

test('profile and lock junctions cannot redirect deletion', async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'verify-junction-'))
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'verify-outside-'))
  try {
    await fs.writeFile(path.join(outside, 'sentinel'), 'safe')
    const target = profilePath(identifier, 'linked', base)
    await fs.symlink(outside, target, 'junction')
    await assert.rejects(
      claimProfile(identifier, 'linked', base),
      /real directory/
    )
    await fs.symlink(
      outside,
      `${profilePath(identifier, 'lock', base)}.lock`,
      'junction'
    )
    await assert.rejects(
      claimProfile(identifier, 'lock', base),
      /real directory/
    )
    assert.equal(
      await fs.readFile(path.join(outside, 'sentinel'), 'utf8'),
      'safe'
    )
  } finally {
    await fs.rm(base, { recursive: true, force: true })
    await fs.rm(outside, { recursive: true, force: true })
  }
})

test('PID reuse and path changes invalidate ownership', () => {
  const owner = {
    pid: 15,
    created: '2026-10-04T01:00:00Z',
    exe: path.resolve('app.exe'),
  }
  assert(sameProcess(owner, { ...owner }))
  assert(!sameProcess(owner, { ...owner, created: '2026-10-04T02:00:00Z' }))
  assert(!sameProcess(owner, { ...owner, exe: path.resolve('other.exe') }))
  assert(!sameProcess(owner, null))
})

test('storage guard detects creation, deletion and byte changes', () => {
  assert(sameStorage(null, null))
  assert(sameStorage(Buffer.from('a'), Buffer.from('a')))
  assert(!sameStorage(null, Buffer.from('a')))
  assert(!sameStorage(Buffer.from('a'), null))
  assert(!sameStorage(Buffer.from('a'), Buffer.from('b')))
})

test('old executables fail prelaunch capability check', async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'verify-exe-'))
  try {
    const exe = path.join(base, 'old.exe')
    await fs.writeFile(exe, 'old binary')
    assert.equal(await hasProtocolMarker(exe), false)
    await fs.writeFile(exe, 'binary GO_VERIFY_PROTOCOL_V1 marker')
    assert.equal(await hasProtocolMarker(exe), true)
  } finally {
    await fs.rm(base, { recursive: true, force: true })
  }
})

test('only packaged local app origins are valid CDP targets', () => {
  assert(validAppUrl('http://tauri.localhost/#/'))
  assert(validAppUrl('tauri://localhost/#/'))
  for (const url of [
    'http://tauri.localhost.attacker.test',
    'https://hutaobot.moe',
    'about:blank',
    'devtools://devtools',
    'invalid',
  ])
    assert(!validAppUrl(url))
})

test('aborted startup polling cannot continue into an app launch', async () => {
  const controller = new AbortController()
  let polls = 0
  const pending = waitUntil(
    () => {
      polls++
      controller.abort(new Error('test interruption'))
      return false
    },
    'should not time out',
    2000,
    controller.signal
  )
  await assert.rejects(pending, /test interruption/)
  assert.equal(polls, 1)
})

test('explicit recovery refuses a live owner and safely reclaims a dead owner', {
  skip: process.platform !== 'win32',
}, async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'verify-recovery-'))
  try {
    const claim = await claimProfile(identifier, 'stale', base)
    await assert.rejects(
      claimProfile(identifier, 'stale', base, true),
      /owning harness PID is live/
    )
    await fs.writeFile(
      path.join(claim.lockPath, 'owner.json'),
      JSON.stringify({ pid: 2147483647, token: claim.token })
    )
    const recovered = await claimProfile(identifier, 'stale', base, true)
    assert.notEqual(recovered.token, claim.token)
    await releaseProfile(recovered, false)
  } finally {
    await fs.rm(base, { recursive: true, force: true })
  }
})
