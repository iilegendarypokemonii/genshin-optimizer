// Smoke-test the built frontend; the actual installer upgrade is tested on Windows.
import assert from 'node:assert/strict'
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, resolve, sep } from 'node:path'
import { chromium } from '@playwright/test'

const root = resolve('dist/apps/frontend')
const output = resolve('.codex-run/desktop-release')
const contentTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
}
const server = createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname
  const file = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`)
  if (
    !file.startsWith(root + sep) ||
    !existsSync(file) ||
    !statSync(file).isFile()
  ) {
    response.writeHead(404).end()
    return
  }
  response.writeHead(200, {
    'Content-Type': contentTypes[extname(file)] || 'application/octet-stream',
  })
  createReadStream(file).pipe(response)
})
// The OS assigns a free port. This process owns the listener and closes it below.
await new Promise((resolve, reject) => {
  server.once('error', reject)
  server.listen(0, '127.0.0.1', resolve)
})
let browser
try {
  const url = `http://127.0.0.1:${server.address().port}/`
  const response = await fetch(url)
  assert.equal(response.status, 200)
  assert.match(await response.text(), /Genshin Optimizer/)
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1600, height: 960 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.getByRole('tab', { name: /Tools/ }).waitFor()
  assert.equal(
    await page.getByRole('button', { name: 'Check for updates' }).count(),
    0
  )
  await page.getByRole('tab', { name: /Tools/ }).click()
  await page.getByText('Team DPS', { exact: true }).first().waitFor()
  await page.getByRole('tab', { name: /setting/i }).click()
  await page.setViewportSize({ width: 1120, height: 760 })
  const geometry = await page.evaluate(() => ({
    width: innerWidth,
    contentWidth: document.documentElement.scrollWidth,
  }))
  assert.equal(
    geometry.contentWidth,
    geometry.width,
    'Horizontal overflow at desktop minimum width'
  )
  mkdirSync(output, { recursive: true })
  await page.screenshot({
    path: resolve(output, 'web-settings.png'),
    fullPage: true,
  })
  assert.deepEqual(errors, [], 'Frontend script errors')
  console.log(
    'Desktop frontend smoke passed: home, tools, settings, browser isolation, minimum width.'
  )
} finally {
  await browser?.close()
  await new Promise((resolve) => server.close(resolve))
}
