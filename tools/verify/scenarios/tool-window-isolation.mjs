import { createServer } from 'node:http'

// Tool windows show third-party websites. Tauri injects its IPC bridge into
// every page, so the capabilities must refuse native calls from those windows,
// both for the website itself and if it navigates the window to the app.
const LABEL = 'tool-verify-isolation'
const APP_COMMANDS = [
  'get_wish_url',
  'ocr_screenshot',
  'irminsul_status',
  'verify_info',
]
const PLUGIN_COMMANDS = ['plugin:fs|exists', 'plugin:app|version']

async function attempts(page) {
  return page.evaluate(
    async (commands) => {
      const results = {}
      for (const command of commands) {
        try {
          await window.__TAURI_INTERNALS__.invoke(command, {
            relPath: 'verify-isolation.png',
            path: 'verify-isolation',
          })
          results[command] = 'ALLOWED'
        } catch (error) {
          results[command] = String(error?.message ?? error)
        }
      }
      return results
    },
    [...APP_COMMANDS, ...PLUGIN_COMMANDS]
  )
}

function assertRefused(results, where) {
  const allowed = Object.entries(results).filter(
    ([, result]) => !/not allowed/i.test(result)
  )
  if (allowed.length)
    throw new Error(
      `${where} reached native commands: ${JSON.stringify(Object.fromEntries(allowed))}`
    )
  return {
    message: `${where}: all ${Object.keys(results).length} refused`,
    data: results,
  }
}

export default async function toolWindowIsolation(ctx) {
  const server = createServer((_, response) => {
    response.writeHead(200, { 'content-type': 'text/html' })
    response.end('<!doctype html><title>External tool</title><p>External tool')
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const siteUrl = `http://127.0.0.1:${server.address().port}/`
  const appUrl = new URL(ctx.page.url()).origin + '/'
  let toolPage
  try {
    await ctx.step('open-tool-window', async () => {
      await ctx.invoke('plugin:webview|create_webview_window', {
        options: { label: LABEL, url: siteUrl, title: 'Isolation check' },
      })
      // new pages are reported before they navigate, so poll for the URL
      for (let waited = 0; !toolPage && waited < 15000; waited += 250) {
        toolPage = ctx.page
          .context()
          .pages()
          .find((page) => page.url().startsWith(siteUrl))
        if (!toolPage) await new Promise((resolve) => setTimeout(resolve, 250))
      }
      if (!toolPage) throw new Error(`No page at ${siteUrl} appeared over CDP`)
      await toolPage.waitForFunction(() => '__TAURI_INTERNALS__' in window)
      return { message: `Opened ${LABEL} at ${siteUrl}` }
    })
    await ctx.step('external-site-refused', async () =>
      assertRefused(await attempts(toolPage), 'External site')
    )
    await ctx.step('app-origin-in-tool-window-refused', async () => {
      await toolPage.goto(appUrl, { waitUntil: 'domcontentloaded' })
      await toolPage.waitForFunction(() => '__TAURI_INTERNALS__' in window)
      return assertRefused(
        await attempts(toolPage),
        'App page in a tool window'
      )
    })
    await ctx.step('main-window-still-allowed', async () => {
      const info = await ctx.invoke('verify_info')
      return { message: `Main window verify_info: profile ${info.profile}` }
    })
  } finally {
    await toolPage?.close().catch(() => {})
    server.close()
  }
}
