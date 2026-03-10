// Generates latest.json for the Tauri updater from the current build artifacts.
// Usage: node tools/scripts/generate-update-json.mjs
//
// Upload the output file (desktop/latest.json) alongside the build artifacts
// when creating a GitHub release.

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const rootDir = process.cwd()
const tauriConf = JSON.parse(
  readFileSync(join(rootDir, 'src-tauri', 'tauri.conf.json'), 'utf8')
)
const version = tauriConf.version
const productName = tauriConf.productName
const repo = 'iilegendarypokemonii/genshin-optimizer'

const releaseDir = join(rootDir, 'src-tauri', 'target', 'release', 'bundle')

const nsisZipSig = readFileSync(
  join(releaseDir, 'nsis', `${productName}_${version}_x64-setup.nsis.zip.sig`),
  'utf8'
)

const latest = {
  version: `v${version}`,
  notes: `Release v${version}`,
  pub_date: new Date().toISOString(),
  platforms: {
    'windows-x86_64': {
      signature: nsisZipSig,
      url: `https://github.com/${repo}/releases/download/v${version}/${productName}_${version}_x64-setup.nsis.zip`,
    },
  },
}

const outPath = join(rootDir, 'desktop', 'latest.json')
writeFileSync(outPath, JSON.stringify(latest, null, 2))
console.log(`Generated ${outPath}`)
console.log(`Version: v${version}`)
console.log(`Upload these files to the GitHub release:`)
console.log(`  - ${join(releaseDir, 'nsis', `${productName}_${version}_x64-setup.nsis.zip`)}`)
console.log(`  - desktop/latest.json`)
