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

console.log(`Launching ${exePath}`)
// Launch via explorer.exe (ShellExecute): a direct spawn — even detached or
// through `cmd /c start` — leaks the parent's inheritable pipe handles into
// the app, so `yarn desktop:update` appears to keep running until the app
// is closed. Explorer launches it with no inherited handles.
spawn('explorer.exe', [exePath], { detached: true, stdio: 'ignore' }).unref()
