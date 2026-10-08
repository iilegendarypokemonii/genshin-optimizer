import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import {
  assertListenerOwned,
  bounded,
  freePort,
  processInfo,
  stopOwnedProcess,
  waitUntil,
} from './app-process.mjs'
import {
  claimProfile,
  readOptional,
  releaseProfile,
  sameStorage,
  validateProfileName,
} from './app-profile.mjs'
import { runProcess } from './proc.mjs'

export const PROTOCOL_MARKER = 'GO_VERIFY_PROTOCOL_V1'
export { validateProfileName } from './app-profile.mjs'

export async function hasProtocolMarker(exe) {
  return (await fs.readFile(exe)).includes(Buffer.from(PROTOCOL_MARKER))
}

function harnessError(message) {
  return Object.assign(new Error(message), { exitCode: 2 })
}

async function preflight(root, options, evidence) {
  if (process.platform !== 'win32')
    throw harnessError('App verification requires Windows')
  const config = JSON.parse(
    await fs.readFile(path.join(root, 'src-tauri/tauri.conf.json'), 'utf8')
  )
  const exe = path.resolve(
    root,
    options.exe ?? 'src-tauri/target/release/genshin-optimizer-desktop.exe'
  )
  if (options.build) await build(root, evidence)
  if (!(await hasProtocolMarker(exe)))
    throw harnessError(
      'Incompatible executable: GO_VERIFY_PROTOCOL_V1 missing; rebuild before launching'
    )
  return {
    config,
    exe,
    profileName: validateProfileName(
      options.profile ?? `run-${Date.now().toString(36)}`
    ),
  }
}

async function build(root, evidence) {
  return evidence.check('build', async () => {
    const log = 'logs/build.log'
    const result = await runProcess(
      process.execPath,
      [
        '.yarn/releases/yarn-3.4.1.cjs',
        'tauri',
        'build',
        '--ci',
        '--no-bundle',
      ],
      {
        cwd: root,
        timeoutMs: 1200000,
        logPath: path.join(evidence.dir, log),
      }
    )
    if (result.code !== 0) throw harnessError(`App build failed; see ${log}`)
    return { evidence: [log], data: { durationMs: result.durationMs } }
  })
}

export function validAppUrl(url) {
  try {
    const parsed = new URL(url)
    return (
      (parsed.protocol === 'http:' && parsed.hostname === 'tauri.localhost') ||
      (parsed.protocol === 'tauri:' && parsed.hostname === 'localhost')
    )
  } catch {
    return false
  }
}

async function cdpTarget(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
    signal: AbortSignal.timeout(1500),
  })
  assert(response.ok, 'CDP endpoint failed')
  const pages = (await response.json()).filter(
    (item) => item.type === 'page' && validAppUrl(item.url)
  )
  assert.equal(pages.length, 1, 'Expected exactly one local app page')
  return pages[0]
}

export async function invoke(page, command, args = {}) {
  return page.evaluate(
    ({ command, args }) => window.__TAURI_INTERNALS__.invoke(command, args),
    { command, args }
  )
}

class AppSession {
  constructor(details, evidence, options) {
    Object.assign(this, details)
    this.evidence = evidence
    this.options = options
    this.launchCount = 0
    this.scenario = 'startup'
    this.console = []
    this.errors = []
    this.stdout = []
    this.stderr = []
    this.traceFiles = []
  }

  async launch() {
    this.signal.throwIfAborted()
    const started = Date.now()
    this.launchCount++
    this.port = await freePort()
    this.signal.throwIfAborted()
    const env = {
      ...process.env,
      GO_VERIFY_PROFILE: this.profileName,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${this.port} --remote-debugging-address=127.0.0.1`,
    }
    delete env.WEBVIEW2_USER_DATA_FOLDER
    delete env.TAURI_WEBVIEW2_DATA_DIR
    this.child = spawn(this.exe, [`--go-verify-profile=${this.profileName}`], {
      cwd: this.root,
      env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    this.child.on('error', (error) => {
      this.spawnError = error
    })
    this.child.stdout.on('data', (data) => this.stdout.push(data))
    this.child.stderr.on('data', (data) => this.stderr.push(data))
    await new Promise((resolve, reject) => {
      this.child.once('spawn', resolve)
      this.child.once('error', reject)
    })
    this.identity = await processInfo(this.child.pid)
    assert(this.identity, 'Launched app exited before process identification')
    await fs.writeFile(
      path.join(this.claim.lockPath, 'app.json'),
      JSON.stringify(this.identity)
    )
    const target = await waitUntil(
      () => this.target(),
      'App CDP startup failed',
      45000,
      this.signal
    )
    await assertListenerOwned(this.port, this.identity)
    this.signal.throwIfAborted()
    await this.attach(target)
    this.signal.throwIfAborted()
    this.evidence.report.metrics[`launch${this.launchCount}ToCdpMs`] =
      Date.now() - started
    const info = await this.handshake()
    await this.startTrace()
    await this.page.locator('a[role="tab"][href="#/tools"]').waitFor()
    // Reload only after startup has completed so the trace owns the page's
    // resource responses as well as later UI actions.
    await this.page.reload({ waitUntil: 'domcontentloaded' })
    await this.page.locator('a[role="tab"][href="#/tools"]').waitFor()
    this.signal.throwIfAborted()
    this.evidence.report.metrics[`launch${this.launchCount}ToAppReadyMs`] =
      Date.now() - started
    Object.assign(this.evidence.report.subject, info, {
      cdpPort: this.port,
      pid: this.identity.pid,
    })
    return {
      message: `Ready: ${info.version}, profile ${info.profile}`,
      data: info,
    }
  }

  async target() {
    if (this.spawnError) throw this.spawnError
    if (this.child.exitCode !== null)
      throw harnessError(`App exited with ${this.child.exitCode}`)
    return cdpTarget(this.port)
  }

  async attach(target) {
    const { chromium } = await import('@playwright/test')
    this.browser = await chromium.connectOverCDP(
      `http://127.0.0.1:${this.port}`,
      { timeout: 15000 }
    )
    this.context = this.browser.contexts()[0]
    this.page = this.context.pages().find((page) => page.url() === target.url)
    assert(this.page, 'App page missing after CDP attachment')
    this.page.setDefaultTimeout(15000)
    this.page.setDefaultNavigationTimeout(30000)
    this.page.on('console', (message) =>
      this.console.push({
        scenario: this.scenario,
        type: message.type(),
        text: message.text(),
        location: message.location(),
      })
    )
    this.page.on('pageerror', (error) =>
      this.errors.push({
        scenario: this.scenario,
        message: error.message,
        stack: error.stack,
      })
    )
    this.baseUrl = new URL('/', this.page.url()).href
  }

  async handshake() {
    await this.page.waitForFunction(() =>
      Boolean(window.__TAURI_INTERNALS__?.invoke)
    )
    const info = await invoke(this.page, 'verify_info')
    assert.equal(info.protocol, 1, 'Native verification protocol mismatch')
    assert.equal(
      info.marker,
      PROTOCOL_MARKER,
      'Native verification marker mismatch'
    )
    assert.equal(
      info.liveCaptureDisabled,
      true,
      'Rebuild: native live-capture gate missing'
    )
    await assert.rejects(
      () => invoke(this.page, 'irminsul_start'),
      /Live capture is disabled in verification profiles/
    )
    assert.equal(info.profile, this.profileName, 'Native profile mismatch')
    assert.equal(
      info.identifier,
      `${this.config.identifier}.verify-${this.profileName}`
    )
    assert.equal(
      path.resolve(info.dataDir).toLowerCase(),
      path.resolve(this.claim.target).toLowerCase()
    )
    assert.equal(
      info.version,
      this.config.version,
      'Executable version differs from source configuration'
    )
    const cacheDisabled = await this.page.evaluate(async () => {
      try {
        await window.__TAURI_INTERNALS__.invoke('get_wish_url')
        return false
      } catch (error) {
        return error?.kind === 'VerificationProfile'
      }
    })
    assert(cacheDisabled, 'Verification must not read the real game wish cache')
    return info
  }

  async startTrace() {
    if (this.options['no-trace']) return
    await this.context.tracing.start({
      screenshots: true,
      snapshots: true,
      sources: true,
    })
    this.tracing = true
  }

  async stopTrace() {
    if (!this.tracing) return
    this.tracing = false
    const relative = `traces/launch-${this.launchCount}.zip`
    await fs.mkdir(path.dirname(path.join(this.evidence.dir, relative)), {
      recursive: true,
    })
    await bounded(
      this.context.tracing.stop({
        path: path.join(this.evidence.dir, relative),
      }),
      10000,
      'Trace finalization timed out'
    )
    this.traceFiles.push(relative)
    this.evidence.report.trace = { status: 'saved', files: this.traceFiles }
  }

  async stopProcess() {
    try {
      if (this.identity) {
        await stopOwnedProcess(this.identity)
        this.identity = null
      } else if (this.child && this.child.exitCode === null) {
        this.child.kill()
        await bounded(
          new Promise((resolve) => this.child.once('exit', resolve)),
          10000,
          'App exit timed out'
        )
      }
      this.child = null
    } finally {
      if (this.browser)
        await bounded(this.browser.close(), 10000, 'CDP disconnect timed out')
      this.browser = null
    }
  }

  async restart() {
    this.signal.throwIfAborted()
    await this.stopTrace()
    this.signal.throwIfAborted()
    await this.stopProcess()
    this.signal.throwIfAborted()
    await this.launch()
  }

  async logs() {
    await this.evidence.write('logs/stdout.log', Buffer.concat(this.stdout))
    await this.evidence.write('logs/stderr.log', Buffer.concat(this.stderr))
    await this.evidence.write(
      'logs/console.jsonl',
      this.console.map((line) => JSON.stringify(line)).join('\n')
    )
    await this.evidence.write(
      'logs/page-errors.jsonl',
      this.errors.map((line) => JSON.stringify(line)).join('\n')
    )
    for (const name of new Set([
      'startup',
      this.scenario,
      ...this.console.map((line) => line.scenario),
    ])) {
      await this.evidence.write(
        `scenarios/${name}/console.jsonl`,
        this.console
          .filter((line) => line.scenario === name)
          .map((line) => JSON.stringify(line))
          .join('\n')
      )
      await this.evidence.write(
        `scenarios/${name}/page-errors.jsonl`,
        this.errors
          .filter((line) => line.scenario === name)
          .map((line) => JSON.stringify(line))
          .join('\n')
      )
    }
  }
}

async function screenshot(session, name) {
  const prefix = `scenarios/${session.scenario}/screenshots/${name}`
  const geometry = await session.page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
  }))
  await session.evidence.write(`${prefix}.json`, geometry)
  await session.page.screenshot({
    path: path.join(session.evidence.dir, `${prefix}.png`),
    fullPage: true,
    animations: 'disabled',
    timeout: 10000,
  })
  return [`${prefix}.png`, `${prefix}.json`]
}

async function scenarioStep(session, name, fn) {
  session.signal.throwIfAborted()
  const label = `${String(++session.stepIndex).padStart(2, '0')}-${name.replace(/[^a-z0-9-]/gi, '-')}`
  return session.evidence.check(`${session.scenario}/${name}`, async () => {
    try {
      const result = await fn()
      session.signal.throwIfAborted()
      return { data: result, evidence: await screenshot(session, label) }
    } catch (error) {
      const evidence = await screenshot(session, `${label}-failure`).catch(
        () => []
      )
      const text = await session.page
        .locator('body')
        .innerText({ timeout: 3000 })
        .catch(() => '')
      evidence.push(
        await session.evidence.write(
          `scenarios/${session.scenario}/${label}-failure.txt`,
          `${error.stack}\n\n${text.slice(0, 20000)}`
        )
      )
      error.evidence = evidence
      throw error
    }
  })
}

function scenarioContext(session) {
  return {
    root: session.root,
    options: session.options,
    evidence: session.evidence,
    profile: session.claim.target,
    dataDir: session.claim.target,
    get page() {
      return session.page
    },
    invoke: (command, args) => invoke(session.page, command, args),
    goto: (route) =>
      session.page.goto(`${session.baseUrl}#${route}`, {
        waitUntil: 'domcontentloaded',
      }),
    restart: () => session.restart(),
    step: (name, fn) => scenarioStep(session, name, fn),
    fixture: async (relative) =>
      JSON.parse(
        await fs.readFile(
          path.join(session.root, 'tools/verify/fixtures', relative),
          'utf8'
        )
      ),
    waitForStorage: (predicate) =>
      waitUntil(async () => {
        const value = JSON.parse(
          await fs.readFile(
            path.join(session.claim.target, 'storage/localStorage.json'),
            'utf8'
          )
        )
        return predicate(value) ? value : null
      }, 'Expected data was not persisted'),
  }
}

async function runScenarios(session, names, scenarios) {
  for (const name of names) {
    session.signal.throwIfAborted()
    session.scenario = name
    session.stepIndex = 0
    await scenarios[name](scenarioContext(session))
    await session.evidence.check(`${name}/page-errors`, () => {
      assert.deepEqual(session.errors, [], 'Frontend page errors')
      assert.deepEqual(
        session.console.filter((entry) => entry.type === 'error'),
        [],
        'Frontend console errors'
      )
      return { message: 'No page errors' }
    })
  }
}

function interruptGuard(profile) {
  const controller = new AbortController()
  const handler = () => {
    if (controller.signal.aborted) {
      console.error(
        `Forced exit; recover with: yarn verify app --profile ${profile} --recover`
      )
      process.exit(130)
    }
    controller.abort(harnessError('Verification interrupted'))
  }
  process.on('SIGINT', handler)
  process.on('SIGTERM', handler)
  return {
    signal: controller.signal,
    remove() {
      process.off('SIGINT', handler)
      process.off('SIGTERM', handler)
    },
  }
}

async function cleanup(session, storage, before) {
  let code = 0
  let processStopped = false
  const steps = [
    ['trace', () => session.stopTrace()],
    [
      'process',
      async () => {
        await session.stopProcess()
        processStopped = true
      },
    ],
    ['logs', () => session.logs()],
    [
      'profile',
      () => {
        assert(
          processStopped,
          'Keeping profile and lock because process cleanup failed'
        )
        return releaseProfile(session.claim, session.options['keep-profile'])
      },
    ],
    [
      'real-storage',
      async () =>
        assert(
          sameStorage(before, await readOptional(storage)),
          'Real profile storage changed during verification'
        ),
    ],
  ]
  for (const [name, action] of steps) {
    try {
      await session.evidence.check(`cleanup/${name}`, action)
    } catch {
      code = 2
    }
  }
  return code
}

function selectScenarios(args, scenarios) {
  const names = args.length ? args : ['smoke', 'good-upload', 'irminsul-import']
  for (const name of names) {
    if (!Object.hasOwn(scenarios, name))
      throw Object.assign(new Error(`Unknown scenario: ${name}`), {
        exitCode: 64,
      })
  }
  return names
}

export async function runApp({ root, options = {}, args = [], evidence }) {
  const { scenarios } = await import('../scenarios/index.mjs')
  const names = selectScenarios(args, scenarios)
  const details = await evidence.check('preflight', () =>
    preflight(root, options, evidence)
  )
  const storage = path.join(
    process.env.LOCALAPPDATA,
    details.config.identifier,
    'storage/localStorage.json'
  )
  const before = await readOptional(storage)
  const claim = await claimProfile(
    details.config.identifier,
    details.profileName,
    process.env.LOCALAPPDATA,
    options.recover
  )
  const session = new AppSession({ ...details, root, claim }, evidence, options)
  evidence.report.subject = {
    ...evidence.report.subject,
    exe: details.exe,
    profile: details.profileName,
    dataDir: claim.target,
  }
  evidence.report.trace = {
    status: options['no-trace'] ? 'disabled' : 'pending',
  }
  const interruption = interruptGuard(details.profileName)
  session.signal = interruption.signal
  try {
    return await executeSession(session, names, scenarios, storage, before)
  } finally {
    interruption.remove()
  }
}

async function executeSession(session, names, scenarios, storage, before) {
  const evidence = session.evidence
  let exitCode = 0
  let launched = false
  try {
    await evidence.checkpoint()
    evidence.report.subject.sha256 = createHash('sha256')
      .update(await fs.readFile(session.exe))
      .digest('hex')
    await evidence.check('app-launch', () => session.launch())
    launched = true
    await runScenarios(session, names, scenarios)
  } catch (error) {
    exitCode = error.exitCode ?? (launched ? 1 : 2)
    await recordFailure(session, error)
  } finally {
    const cleanupCode = await cleanup(session, storage, before)
    if (cleanupCode) exitCode = cleanupCode
  }
  return exitCode
}

async function recordFailure(session, error) {
  await session.evidence.write('logs/app-failure.txt', error.stack)
  if (!session.page) return
  await screenshot(session, 'run-failure').catch(() => {})
  const text = await session.page
    .locator('body')
    .innerText({ timeout: 3000 })
    .catch(() => '')
  await session.evidence.write(
    `scenarios/${session.scenario}/run-failure.txt`,
    text
  )
}
