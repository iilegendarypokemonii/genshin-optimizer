import { spawn, spawnSync } from 'node:child_process'

if (process.platform === 'win32') {
  const result = spawnSync(
    'taskkill',
    ['/IM', 'genshin-optimizer-desktop.exe', '/F', '/T'],
    { stdio: 'inherit' }
  )

  // 128 means there was no matching process to kill.
  if (result.status !== 0 && result.status !== 128) process.exit(result.status)
}

const child = spawn(
  process.execPath,
  ['.yarn/releases/yarn-3.4.1.cjs', 'tauri', 'dev', '--no-watch'],
  {
    cwd: process.cwd(),
    stdio: 'inherit',
  }
)

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 1)
})

child.on('error', (error) => {
  console.error('Failed to start Tauri dev:', error)
  process.exit(1)
})
