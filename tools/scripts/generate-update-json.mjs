// Package Tauri v2's signed NSIS installer for a desktop GitHub Release.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const releaseRepo = 'iilegendarypokemonii/genshin-optimizer'
export const installerName = 'Genshin-Optimizer-Local-Setup.exe'

export function validateDesktopTag(rootDir, tag) {
  const config = JSON.parse(
    readFileSync(join(rootDir, 'src-tauri/tauri.conf.json'), 'utf8')
  )
  if (!/^\d+\.\d+\.\d+$/.test(config.version))
    throw new Error('Desktop releases require a stable x.y.z version.')
  if (tag !== `desktop-v${config.version}`)
    throw new Error(`Tag must be desktop-v${config.version}.`)
  const cargo = readFileSync(join(rootDir, 'src-tauri/Cargo.toml'), 'utf8')
  const cargoVersion = cargo.match(
    /\[package\][\s\S]*?\nversion\s*=\s*"([^"]+)"/
  )?.[1]
  if (cargoVersion !== config.version)
    throw new Error('Cargo.toml and tauri.conf.json versions must match.')
  return config
}

export function packageDesktopRelease(rootDir, tag) {
  const config = validateDesktopTag(rootDir, tag)
  const bundleDir = join(rootDir, 'src-tauri/target/release/bundle/nsis')
  const source = join(
    bundleDir,
    `${config.productName}_${config.version}_x64-setup.exe`
  )
  const signature = readFileSync(`${source}.sig`, 'utf8').trim()
  if (!signature) throw new Error('Missing installer signature.')
  const outDir = join(rootDir, 'desktop/release')
  mkdirSync(outDir, { recursive: true })
  copyFileSync(source, join(outDir, installerName))
  writeFileSync(join(outDir, `${installerName}.sig`), signature)
  const releaseUrl = `https://github.com/${releaseRepo}/releases/tag/${tag}`
  const manifest = {
    version: config.version,
    notes: `Genshin Optimizer Local ${config.version}\nRelease details: ${releaseUrl}`,
    pub_date: new Date().toISOString(),
    platforms: {
      'windows-x86_64': {
        signature,
        url: `https://github.com/${releaseRepo}/releases/download/${tag}/${installerName}`,
      },
    },
  }
  writeFileSync(
    join(outDir, 'latest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`
  )
  writeFileSync(
    join(outDir, 'release-notes.md'),
    `Windows desktop release ${config.version} of this personal Genshin Optimizer modification.\n\n` +
      `**Install:** Download **${installerName}** below and run it. Windows 10/11, Intel/AMD 64-bit. No developer tools needed.\n\n` +
      '**Update:** Existing installed copies can use **Check for updates** at the bottom of the app, then **Update and restart**. Your saved data remains on your PC.\n\n' +
      'Includes Game data with shared **Account data / Wishes** tabs, separate login snapshots per UID, filtered imports and exports, and batch account imports with backups. **Account capture requires Windows 11 24H2 or newer.** Snapshots reflect inventory at login; log in again to refresh them after playing.\n\n' +
      'Also includes local storage, the Tools page, Wish Tracker with game-cache import, and Team DPS screenshot OCR.\n\n' +
      'The `.sig` and `latest.json` files are used by the updater. The source-code downloads are for developers.\n\n' +
      `Read the [installation guide](https://github.com/${releaseRepo}#install-on-windows) for setup and troubleshooting.\n`
  )
  return manifest
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const rootDir = process.cwd()
  const tag = process.argv[2] || process.env.DESKTOP_RELEASE_TAG
  if (process.argv.includes('--validate-only')) {
    validateDesktopTag(rootDir, tag)
    console.log(`Validated desktop release ${tag}`)
  } else {
    packageDesktopRelease(rootDir, tag)
    console.log(`Packaged desktop release ${tag} in desktop/release/`)
  }
}
