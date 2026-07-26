import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { copiesNeeded, extractAccountState, planQuestion } from './model.mjs'

const APP_DIR = path.join(
  os.homedir(),
  'AppData',
  'Local',
  'com.iilegendarypokemonii.genshinoptimizerlocal'
)
const WISH_DIR = path.join(APP_DIR, 'wishes')
const STORAGE_FILE = path.join(APP_DIR, 'storage', 'localStorage.json')

function argsToObject(args) {
  const parsed = {}
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (!arg.startsWith('--')) continue
    const key = arg.slice(2)
    parsed[key] = args[i + 1]?.startsWith('--') ? true : (args[++i] ?? true)
  }
  return parsed
}

function profileMeta(raw, source, selected = false) {
  if (!raw) return null
  const meta = JSON.parse(raw)
  if (!meta.uid) return null
  return { ...meta, source, selected }
}

function loadProfiles() {
  const storage = JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf8'))
  const profiles = [profileMeta(storage.dbMeta, 'main', true)]

  for (const [key, value] of Object.entries(storage)) {
    if (!key.startsWith('extraDatabase_')) continue
    const database = JSON.parse(value)
    profiles.push(profileMeta(database.dbMeta, key))
  }

  const byUid = new Map()
  for (const profile of profiles.filter(Boolean)) {
    const existing = byUid.get(profile.uid)
    if (!existing || profile.selected) byUid.set(profile.uid, profile)
  }
  return [...byUid.values()]
}

function normalize(value) {
  return String(value)
    .toLowerCase()
    .replaceAll(/[^a-z0-9]/g, '')
}

function resolveProfile(requested) {
  const profiles = loadProfiles()
  if (!requested)
    return profiles.find((profile) => profile.selected) ?? profiles[0]

  const wanted = normalize(requested)
  const expanded = /^\d+$/.test(wanted) ? `acc${wanted}` : wanted
  const match = profiles.find(
    (profile) =>
      profile.uid === requested ||
      normalize(profile.name) === wanted ||
      normalize(profile.name) === expanded
  )
  if (!match)
    throw new Error(
      `Unknown account ${requested}. Available: ${profiles
        .map((profile) => `${profile.name} (${profile.uid})`)
        .join(', ')}`
    )
  return match
}

function loadAccount(profile) {
  const filePath = path.join(WISH_DIR, `wishes_${profile.uid}.json`)
  return extractAccountState(JSON.parse(fs.readFileSync(filePath, 'utf8')))
}

function numberArg(value) {
  const number = Number(value ?? 0)
  if (!Number.isFinite(number) || number < 0)
    throw new Error(`Expected a non-negative number, got ${value}`)
  return Math.floor(number)
}

function percentage(value) {
  if (value >= 1 - 1e-12) return '100.0%'
  return `${(value * 100).toFixed(value >= 0.1 ? 1 : 2)}%`
}

function render(result) {
  const { request, profile, account, plan } = result
  const currentLabel =
    request.current.toLowerCase() === 'unowned'
      ? 'unowned'
      : request.current.toUpperCase()
  const lines = [
    `${request.character} ${request.target.toUpperCase()} on ${profile.name}`,
    `Wish export: ${account.exported}; UID ${account.uid}`,
    `Current state: pity ${account.currentPity}, ordinary guarantee ${account.guaranteed ? 'yes' : 'no'}, radiance ${account.radianceScore}, last 5-star ${account.lastFiveStar ?? 'none'}`,
    `Copies needed: ${request.targetCopies} (${currentLabel} -> ${request.target.toUpperCase()})`,
    `Expected: ${plan.expectedPulls.toFixed(1)} pulls (${plan.expectedPrimogems.toLocaleString()} Primogems)`,
    `50%: ${plan.milestones[0.5]} pulls; 75%: ${plan.milestones[0.75]}; 90%: ${plan.milestones[0.9]}; 95%: ${plan.milestones[0.95]}; 99%: ${plan.milestones[0.99]}`,
    `Worst case: ${plan.worstCasePulls} pulls (${plan.worstCasePrimogems.toLocaleString()} Primogems)`,
  ]

  if (request.hasBudget) {
    lines.push(
      `Budget: ${plan.totalPrimogems.toLocaleString()} Primogems + ${plan.totalFates} fates = ${plan.availablePulls} pulls, with ${plan.leftoverPrimogems} Primogems left`,
      `Chance with budget: ${percentage(plan.chance)}`
    )
  }

  lines.push(
    'Assumes the character is rate-up, the listed wish state is unchanged before pulling, and no Starglitter refunds.',
    "Radiance uses Hu Tao's hypothesis-A score model; HoYoverse has not published these per-score odds."
  )
  return lines.join('\n')
}

const args = argsToObject(process.argv.slice(2))
const profile = resolveProfile(args.account)
const account = loadAccount(profile)
const current = String(args.current ?? 'unowned')
const target = String(args.target ?? 'C0')
const request = {
  character: String(args.character ?? 'Featured character'),
  current,
  target,
  targetCopies: copiesNeeded(current, target),
  primogems: numberArg(args.primos),
  futurePrimogems: numberArg(args.future),
  fates: numberArg(args.fates),
  futureFates: numberArg(args['future-fates']),
  hasBudget: ['primos', 'future', 'fates', 'future-fates'].some((key) =>
    Object.hasOwn(args, key)
  ),
}
const plan = planQuestion({ account, ...request })
const result = { request, profile, account, plan }

if (args.json) {
  const { cumulative: _cumulative, ...summaryPlan } = plan
  console.log(JSON.stringify({ ...result, plan: summaryPlan }, null, 2))
} else console.log(render(result))
