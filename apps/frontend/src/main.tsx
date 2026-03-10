import '@fontsource/roboto/300.css'
import '@fontsource/roboto/400.css'
import '@fontsource/roboto/500.css'
import '@fontsource/roboto/700.css'
import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { initializeDesktopStorage } from './persistentStorage'

function renderStartupScreen(message = 'Loading Genshin Optimizer...') {
  const rootElement = document.getElementById('root')
  if (!rootElement) return

  rootElement.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at top, #1f2b4d 0%, #111827 100%);color:#f5f7ff;font-family:Roboto,Arial,sans-serif;">
      <div style="display:flex;align-items:center;gap:12px;padding:24px 28px;border-radius:16px;background:rgba(10,15,30,0.55);box-shadow:0 20px 60px rgba(0,0,0,0.35);">
        <div style="width:18px;height:18px;border-radius:999px;border:2px solid rgba(119,189,251,0.25);border-top-color:#77bdfb;animation:go-spin 0.9s linear infinite;"></div>
        <div style="font-size:16px;font-weight:500;">${message}</div>
      </div>
    </div>
  `
}

function renderFatalError(error: unknown) {
  const rootElement = document.getElementById('root')
  if (!rootElement) return

  const parsedError =
    error instanceof Error
      ? {
          name: error.name,
          message: error.message,
          stack: error.stack ?? 'No stack trace available',
        }
      : {
          name: 'UnknownError',
          message: String(error),
          stack: 'No stack trace available',
        }

  rootElement.innerHTML = `
    <div style="min-height:100vh;padding:24px;background:#0c1020;color:#f5f7ff;font-family:Consolas,monospace;">
      <h1 style="margin:0 0 16px;font-size:24px;">Startup error</h1>
      <p style="margin:0 0 16px;">The desktop app failed during initialization.</p>
      <pre style="white-space:pre-wrap;word-break:break-word;background:#151b31;padding:16px;border-radius:8px;">${[
        `Name: ${parsedError.name}`,
        `Message: ${parsedError.message}`,
        `Stack: ${parsedError.stack}`,
      ].join('\n\n')}</pre>
    </div>
  `
}

window.addEventListener('error', (event) => {
  renderFatalError(event.error ?? event.message)
})

window.addEventListener('unhandledrejection', (event) => {
  renderFatalError(event.reason)
})

async function bootstrap() {
  try {
    renderStartupScreen()
    // Show the window as soon as the loading screen is painted (hidden by default to avoid white flash)
    import('@tauri-apps/api/window')
      .then(({ getCurrentWindow }) => getCurrentWindow().show())
      .catch(() => {}) // not in Tauri context (e.g. web browser)
    await initializeDesktopStorage()
    const [{ default: App }] = await Promise.all([import('./app/App')])
    const root = createRoot(document.getElementById('root') as HTMLElement)
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    )
    // Check for updates in the background after the app is ready
    checkForUpdates()
  } catch (error) {
    console.error('Startup error', error)
    renderFatalError(error)
  }
}

async function checkForUpdates() {
  try {
    const { check } = await import('@tauri-apps/plugin-updater')
    const { relaunch } = await import('@tauri-apps/plugin-process')
    const { ask } = await import('@tauri-apps/plugin-dialog')

    const update = await check()
    if (!update) return

    const yes = await ask(
      `Version ${update.version} is available. Update and restart now?`,
      { title: 'Update Available', kind: 'info', okLabel: 'Update', cancelLabel: 'Later' }
    )
    if (!yes) return

    await update.downloadAndInstall()
    await relaunch()
  } catch {
    // Update check is best-effort — don't bother the user if it fails
  }
}

void bootstrap()
