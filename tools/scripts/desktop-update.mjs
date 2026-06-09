import { spawn, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const rootDir = process.cwd()
const tauriConfig = JSON.parse(
  readFileSync(join(rootDir, 'src-tauri', 'tauri.conf.json'), 'utf8')
)
const exePath = join(rootDir, 'desktop', `${tauriConfig.productName}.exe`)

// Windows locks a running exe, so kill both image names before building/copying.
if (process.platform === 'win32') {
  for (const image of [
    'genshin-optimizer-desktop.exe',
    `${tauriConfig.productName}.exe`,
  ]) {
    const result = spawnSync('taskkill', ['/IM', image, '/F', '/T'], {
      stdio: 'inherit',
    })
    // 128 means there was no matching process to kill.
    if (result.status !== 0 && result.status !== 128)
      process.exit(result.status)
  }
}

const build = spawnSync(
  process.execPath,
  ['tools/scripts/desktop-build.mjs'],
  { cwd: rootDir, stdio: 'inherit' }
)
if (build.status !== 0) process.exit(build.status ?? 1)

const app = spawn(exePath, [], { detached: true, stdio: 'ignore' })
app.unref()
console.log(`Launched ${exePath}`)
