import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { parseArgs } from './cli.mjs'
import { skippedChecks } from './commands/release.mjs'
import { createEvidence, safeRelativePath } from './lib/evidence.mjs'
import { runProcess } from './lib/proc.mjs'

test('CLI rejects unknown commands and invalid options with 64', () => {
  assert.throws(
    () => parseArgs(['wat']),
    (error) => error.exitCode === 64
  )
  assert.throws(
    () => parseArgs(['app', '--unknown']),
    (error) => error.exitCode === 64
  )
  assert.throws(
    () => parseArgs(['release', '--stage', 'middle']),
    (error) => error.exitCode === 64
  )
  assert.throws(
    () => parseArgs(['patch', 'extra']),
    (error) => error.exitCode === 64
  )
})

test('argument parser accepts documented command shapes', () => {
  assert.deepEqual(parseArgs(['app', '--build', 'smoke']), {
    command: 'app',
    options: { build: true },
    args: ['smoke'],
  })
  assert.deepEqual(
    parseArgs(['app', '--keep-profile', '--no-trace', 'smoke']).options,
    { 'keep-profile': true, 'no-trace': true }
  )
  assert.deepEqual(
    parseArgs(['release', '--stage', 'tag,pre', '--tag', 'desktop-v1.2.3'])
      .options,
    { stage: 'tag,pre', tag: 'desktop-v1.2.3' }
  )
  assert.deepEqual(parseArgs(['patch', '--offline']).options, {
    offline: true,
  })
})

test('evidence records failures and rejects traversal', async () => {
  const root = await mkdtemp(join(tmpdir(), 'verify-evidence-'))
  try {
    assert.throws(() => safeRelativePath('../outside.txt'))
    const evidence = await createEvidence(root, 'test')
    evidence.report.subject.profile = 'interrupted-profile'
    await evidence.checkpoint()
    const running = JSON.parse(
      await readFile(join(root, '.verify', 'latest.json'), 'utf8')
    )
    assert.equal(running.status, 'running')
    assert.equal(running.subject.profile, 'interrupted-profile')
    assert.equal(running.exitCode, null)
    const failure = Object.assign(new Error('expected'), {
      evidence: ['screens/failure.png', 'logs/page.txt'],
    })
    await assert.rejects(
      evidence.check('broken', () => {
        throw failure
      }),
      /expected/
    )
    const report = await evidence.finish(1)
    assert.equal(report.schema, 1)
    assert.equal(report.checks[0].status, 'failed')
    assert.deepEqual(report.checks[0].evidence, failure.evidence)
    assert.equal(
      JSON.parse(await readFile(join(root, '.verify', 'latest.json'), 'utf8'))
        .exitCode,
      1
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('release --skip accepts known checks only', () => {
  assert.deepEqual(
    parseArgs(['release', '--stage', 'post', '--skip', 'desktop-app']).options,
    { stage: 'post', skip: 'desktop-app' }
  )
  assert.deepEqual(
    [...skippedChecks('desktop-app,web-smoke')],
    ['desktop-app', 'web-smoke']
  )
  assert.throws(
    () => skippedChecks('desktop-ap'),
    (error) => error.exitCode === 64
  )
})

test('optional irminsul error scenario is accepted by app parsing', () => {
  assert.deepEqual(parseArgs(['app', 'irminsul-error']).args, [
    'irminsul-error',
  ])
})

test('process timeout kills the owned process and reports timedOut', async () => {
  const result = await runProcess(
    process.execPath,
    ['-e', 'setTimeout(() => {}, 10000)'],
    { timeoutMs: 50 }
  )
  assert.equal(result.timedOut, true)
  assert.equal(result.code, null)
})

test('evidence run directories are unique', async () => {
  const root = await mkdtemp(join(tmpdir(), 'verify-unique-'))
  try {
    const [a, b] = await Promise.all([
      createEvidence(root, 'a'),
      createEvidence(root, 'b'),
    ])
    assert.notEqual(a.dir, b.dir)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('desktop release workflow delegates all stages and always uploads evidence', async () => {
  const workflow = await readFile(
    new URL('../../.github/workflows/desktop-release.yml', import.meta.url),
    'utf8'
  )
  for (const stage of ['tag', 'pre', 'post'])
    assert.match(
      workflow,
      new RegExp(`(?:verify|tools/verify/cli\\.mjs) release --stage ${stage}`)
    )
  assert.doesNotMatch(
    workflow,
    /vitest\.mjs|tsc --noEmit|cargo test|node --test|desktop-web-smoke\.mjs/
  )
  assert.match(
    workflow,
    /name: Upload verification evidence[\s\S]*?if: always\(\)/
  )
  const release = await readFile(
    new URL('./commands/release.mjs', import.meta.url),
    'utf8'
  )
  assert.doesNotMatch(
    release.slice(release.indexOf('pre: ['), release.indexOf('post: [')),
    /desktop:build|install --immutable/
  )
})
