import { spawn } from 'node:child_process'

const devUrl = 'http://127.0.0.1:4200'

async function isServerReady() {
  try {
    const response = await fetch(devUrl)
    return response.ok
  } catch {
    return false
  }
}

if (await isServerReady()) {
  console.log(`Reusing existing frontend dev server at ${devUrl}`)
  process.exit(0)
}

const child = spawn(
  process.execPath,
  ['.yarn/releases/yarn-3.4.1.cjs', 'frontend:desktop'],
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
  console.error('Failed to start frontend dev server:', error)
  process.exit(1)
})
