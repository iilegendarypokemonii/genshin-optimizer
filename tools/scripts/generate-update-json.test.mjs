import assert from 'node:assert/strict'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  installerName,
  packageDesktopRelease,
  validateDesktopTag,
} from './generate-update-json.mjs'

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'go-release-test-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const nsis = join(root, 'src-tauri/target/release/bundle/nsis')
  mkdirSync(nsis, { recursive: true })
  writeFileSync(
    join(root, 'src-tauri/tauri.conf.json'),
    JSON.stringify({ version: '0.2.0', productName: 'Genshin Optimizer Local' })
  )
  writeFileSync(
    join(root, 'src-tauri/Cargo.toml'),
    '[package]\nversion = "0.2.0"\n'
  )
  const exe = join(nsis, 'Genshin Optimizer Local_0.2.0_x64-setup.exe')
  writeFileSync(exe, 'synthetic installer bytes')
  writeFileSync(`${exe}.sig`, 'synthetic-signature\n')
  return { root, exe }
}

test('packages unchanged installer bytes with a v2 manifest pointing to this fork', (t) => {
  const { root } = fixture(t)
  const manifest = packageDesktopRelease(root, 'desktop-v0.2.0')
  assert.equal(manifest.version, '0.2.0')
  assert.equal(
    manifest.platforms['windows-x86_64'].signature,
    'synthetic-signature'
  )
  assert.equal(
    manifest.platforms['windows-x86_64'].url,
    `https://github.com/iilegendarypokemonii/genshin-optimizer/releases/download/desktop-v0.2.0/${installerName}`
  )
  assert.equal(
    readFileSync(join(root, 'desktop/release', installerName), 'utf8'),
    'synthetic installer bytes'
  )
})
test('rejects upstream tags and mismatched desktop tags', (t) => {
  const { root } = fixture(t)
  for (const tag of ['10.38.1', 'desktop-v0.3.0', 'desktop-v0.2.0-beta.1'])
    assert.throws(() => validateDesktopTag(root, tag), /Tag must be/)
})
test('rejects conflicting native package versions', (t) => {
  const { root } = fixture(t)
  writeFileSync(
    join(root, 'src-tauri/Cargo.toml'),
    '[package]\nversion = "0.1.0"\n'
  )
  assert.throws(() => validateDesktopTag(root, 'desktop-v0.2.0'), /must match/)
})
test('refuses an unsigned installer', (t) => {
  const { root, exe } = fixture(t)
  writeFileSync(`${exe}.sig`, '')
  assert.throws(
    () => packageDesktopRelease(root, 'desktop-v0.2.0'),
    /Missing installer signature/
  )
})
