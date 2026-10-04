import { readFile, readdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { gunzipSync } from 'node:zlib'
import { runProcess } from '../lib/proc.mjs'

const exec = promisify(execFile)
const CORE = 'crates/irminsul-core'

export function dependencyPin(toml, name) {
  const line = toml.split(/\r?\n/).find((line) => line.startsWith(`${name} =`))
  const pin = line?.match(/rev\s*=\s*"([a-f0-9]{40})"/)?.[1]
  if (!pin) throw new Error(`Missing ${name} pinned revision`)
  return pin
}

async function git(root, args) {
  const result = await runProcess('git', args, { cwd: root, timeoutMs: 60000 })
  if (result.code !== 0)
    throw new Error(result.stderr.trim() || `git ${args[0]} failed`)
  return result.stdout.trim()
}

async function github(endpoint, root) {
  const result = await runProcess('gh', ['api', endpoint], {
    cwd: root,
    timeoutMs: 45000,
  })
  if (result.code !== 0)
    throw new Error(`GitHub ${endpoint}: ${result.stderr.trim()}`)
  return JSON.parse(result.stdout)
}

async function coreRepository(root, pin) {
  const candidates = [join(dirname(root), 'irminsul')]
  const cache = join(homedir(), '.cargo/git/checkouts')
  for (const entry of await readdir(cache).catch(() => [])) {
    if (!entry.startsWith('irminsul-')) continue
    for (const revision of await readdir(join(cache, entry)))
      candidates.push(join(cache, entry, revision))
  }
  for (const candidate of candidates) {
    try {
      await git(candidate, ['cat-file', '-e', `${pin}^{commit}`])
      return candidate
    } catch {
      /* Try the Cargo cache when a sibling checkout does not have the pin. */
    }
  }
  throw new Error(
    'Pinned Irminsul source is unavailable locally; run cargo fetch first'
  )
}

async function readAt(repo, pin, file) {
  const { stdout } = await exec('git', ['show', `${pin}:${file}`], {
    cwd: repo,
    encoding: 'buffer',
    maxBuffer: 20000000,
    timeout: 15000,
    windowsHide: true,
  })
  return stdout
}

async function pinnedSources(root) {
  const pin = dependencyPin(
    await readFile(join(root, 'src-tauri/Cargo.toml'), 'utf8'),
    'irminsul-core'
  )
  const repo = await coreRepository(root, pin)
  const toml = (await readAt(repo, pin, `${CORE}/Cargo.toml`)).toString('utf8')
  const snapshot = JSON.parse(
    gunzipSync(await readAt(repo, pin, `${CORE}/data/game-data.json.gz`))
  )
  return {
    pin,
    repo,
    animePin: dependencyPin(toml, 'anime-game-data'),
    gameDataHash: snapshot.git_hash,
    decoderUpdatedAt: await git(repo, [
      'log',
      '-1',
      '--format=%cI',
      pin,
      '--',
      `${CORE}/vendor/auto-artifactarium`,
    ]),
  }
}

async function goComparisons(root) {
  const pending = await git(root, [
    'log',
    '--format=%h %s',
    'master..upstream/master',
    '--',
    'libs/gi/stats',
  ])
  const upstreamMissing = Number(
    await git(root, ['rev-list', '--count', 'master..upstream/master'])
  )
  const desktopMissing = Number(
    await git(root, ['rev-list', '--count', 'desktop..master'])
  )
  return {
    attention: upstreamMissing > 0 || desktopMissing > 0,
    upstreamMissing,
    desktopMissing,
    pendingStatsCommits: pending ? pending.split('\n') : [],
    refs: {
      master: await git(root, ['rev-parse', 'master']),
      desktop: await git(root, ['rev-parse', 'desktop']),
      upstream: await git(root, ['rev-parse', 'upstream/master']),
    },
  }
}

async function contentPulls(root) {
  const pulls = await github(
    'repos/frzyc/genshin-optimizer/pulls?state=open&per_page=100',
    root
  )
  const content = []
  for (const pull of pulls) {
    const files = await github(
      `repos/frzyc/genshin-optimizer/pulls/${pull.number}/files?per_page=100`,
      root
    )
    if (
      /content|luna|character|weapon|sig\b/i.test(pull.title) ||
      files.some((file) => /^libs\/gi\/(stats|consts)\//.test(file.filename))
    ) {
      content.push({
        number: pull.number,
        title: pull.title,
        url: pull.html_url,
      })
    }
  }
  return {
    attention: content.length > 0,
    pulls: content,
    truncated: pulls.length === 100,
  }
}

async function compareGithub(repo, base, head, root) {
  const result = await github(`repos/${repo}/compare/${base}...${head}`, root)
  return {
    attention: result.ahead_by > 0,
    ahead: result.ahead_by,
    behind: result.behind_by,
    status: result.status,
    url: result.html_url,
    base,
    head,
  }
}

async function dimbreath(hash) {
  if (!hash) throw new Error('Bundled game-data git_hash is missing')
  const response = await fetch(
    'https://gitlab.com/api/v4/projects/83871005/repository/commits?per_page=1',
    { signal: AbortSignal.timeout(30000) }
  )
  if (!response.ok)
    throw new Error(`Dimbreath GitLab API returned ${response.status}`)
  const [latest] = await response.json()
  if (!latest?.id) throw new Error('Dimbreath returned no commits')
  return {
    attention: hash !== latest.id,
    bundled: hash,
    latest: latest.id,
    title: latest.title,
    date: latest.committed_date,
    url: latest.web_url,
  }
}

export async function run({ root, options, evidence }) {
  let attention = false
  let unavailable = false
  async function collect(id, fn) {
    try {
      const result = await evidence.check(`patch/${id}`, async () => {
        const data = await fn()
        if (data.attention) attention = true
        return {
          message: data.attention ? 'Needs attention' : 'Checked',
          data,
        }
      })
      return result.data
    } catch {
      unavailable = true
      return null
    }
  }
  evidence.report.subject.mode = options.offline
    ? 'offline-local-refs-only'
    : 'online'
  if (!options.offline)
    await collect('fetch-upstream', async () => ({
      output: await git(root, ['fetch', 'upstream']),
    }))
  await collect('optimizer', () => goComparisons(root))
  const source = await collect('pinned-sources', () => pinnedSources(root))
  if (options.offline) {
    evidence.report.subject.limitations =
      'No network requests. Remote heads, PRs and source freshness have not been checked.'
    return unavailable ? 2 : attention ? 3 : 0
  }
  await collect('content-pulls', () => contentPulls(root))
  if (!source) return 2
  await collect('irminsul-fork', () =>
    compareGithub(
      'iilegendarypokemonii/irminsul',
      source.pin,
      'multi-account',
      root
    )
  )
  await collect('irminsul-upstream', async () => {
    const upstream = await github('repos/konkers/irminsul', root)
    return compareGithub(
      'iilegendarypokemonii/irminsul',
      source.pin,
      `konkers:${upstream.default_branch}`,
      root
    )
  })
  await collect('decoder', async () => {
    if (!source.decoderUpdatedAt) throw new Error('Vendor update date missing')
    const commits = await github(
      `repos/konkers/auto-artifactarium/commits?since=${encodeURIComponent(source.decoderUpdatedAt)}&per_page=100`,
      root
    )
    return {
      attention: commits.length > 0,
      since: source.decoderUpdatedAt,
      commits: commits.map((commit) => ({
        sha: commit.sha,
        title: commit.commit.message.split('\n')[0],
      })),
      truncated: commits.length === 100,
    }
  })
  await collect('anime-game-data', async () => {
    const repo = await github('repos/konkers/anime-game-data', root)
    return compareGithub(
      'konkers/anime-game-data',
      source.animePin,
      repo.default_branch,
      root
    )
  })
  await collect('dimbreath', () => dimbreath(source.gameDataHash))
  return unavailable ? 2 : attention ? 3 : 0
}
