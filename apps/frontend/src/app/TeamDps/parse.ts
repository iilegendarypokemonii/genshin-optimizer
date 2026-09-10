import type { CharacterKey } from '@genshin-optimizer/gi/consts'
import type { OcrLine } from './types'

export type CharNameMap = Partial<Record<CharacterKey, string>>

export interface ParsedContribution {
  character?: CharacterKey
  rawName: string
  damage: number
  pct?: number
}

export interface ParsedScreenshot {
  dps?: number
  totalDamage?: number
  contributions: ParsedContribution[]
  timeElapsedSec?: number
  strongestHit?: number
  uid?: string
  /** Up to 4 team members: contribution characters first, then right-rail names. */
  team: (CharacterKey | undefined)[]
  warnings: string[]
}

export const TEAM_SIZE = 4

/** Normalize an OCR line: exotic spaces, fullwidth colon, collapsed whitespace. */
function normalizeLine(text: string): string {
  return text
    .replace(/[\u2000-\u200B\u202F\u205F\u2060\u00A0\uFEFF]/g, ' ')
    .replace(/\uFF1A/g, ':')
    .replace(/\s+/g, ' ')
    .trim()
}

/** "589 311" / "23,498,282" -> integer. Returns undefined when not a clean digit run. */
function num(raw: string): number | undefined {
  const cleaned = raw.replace(/[\s,]/g, '')
  if (!/^\d+$/.test(cleaned)) return undefined
  const n = Number(cleaned)
  return Number.isSafeInteger(n) ? n : undefined
}

/** Lowercased alphanumeric-only representation for fuzzy name comparison. */
function normName(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  const m = a.length
  const n = b.length
  if (!m || !n) return Math.max(m, n)
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
    }
    prev = cur
  }
  return prev[n]
}

interface NameCandidate {
  character: CharacterKey
  norm: string
}

function buildCandidates(nameMap: CharNameMap): NameCandidate[] {
  const candidates: NameCandidate[] = []
  for (const [character, name] of Object.entries(nameMap) as [
    CharacterKey,
    string,
  ][]) {
    const nameNorm = normName(name)
    candidates.push({ character, norm: nameNorm })
    const keyNorm = normName(character)
    if (keyNorm !== nameNorm) candidates.push({ character, norm: keyNorm })
  }
  return candidates
}

type NameMatch =
  | { character: CharacterKey; ambiguous?: undefined }
  | { character: undefined; ambiguous: boolean }

function matchName(raw: string, candidates: NameCandidate[]): NameMatch {
  const target = normName(raw)
  if (target.length < 2) return { character: undefined, ambiguous: false }

  const uniq = (chars: CharacterKey[]) => [...new Set(chars)]

  const exact = uniq(
    candidates.filter((c) => c.norm === target).map((c) => c.character)
  )
  if (exact.length === 1) return { character: exact[0] }
  if (exact.length > 1) return { character: undefined, ambiguous: true }

  if (target.length >= 4) {
    const substr = uniq(
      candidates
        .filter(
          (c) =>
            c.norm.length >= 4 &&
            (c.norm.includes(target) || target.includes(c.norm))
        )
        .map((c) => c.character)
    )
    if (substr.length === 1) return { character: substr[0] }
    if (substr.length > 1) return { character: undefined, ambiguous: true }
  }

  const maxDist = target.length >= 6 ? 2 : 1
  let bestDist = maxDist + 1
  let best: CharacterKey[] = []
  for (const c of candidates) {
    const d = levenshtein(target, c.norm)
    if (d < bestDist) {
      bestDist = d
      best = [c.character]
    } else if (d === bestDist && !best.includes(c.character)) {
      best.push(c.character)
    }
  }
  if (bestDist <= maxDist && best.length === 1) return { character: best[0] }
  return {
    character: undefined,
    ambiguous: best.length > 1 && bestDist <= maxDist,
  }
}

const CONTRIBUTION_RE =
  /^(.{2,40}?)\s*:\s*([\d][\d ,]*)\s*\(\s*(\d{1,3})\s*%\s*\)$/

export function parseOcrLines(
  rawLines: OcrLine[],
  nameMap: CharNameMap
): ParsedScreenshot {
  const warnings: string[] = []
  const candidates = buildCandidates(nameMap)
  // reading order
  const lines = [...rawLines]
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((l) => ({ ...l, text: normalizeLine(l.text) }))
    .filter((l) => l.text)

  let dps: number | undefined
  let totalDamage: number | undefined
  let timeElapsedSec: number | undefined
  let strongestHit: number | undefined
  let uid: string | undefined
  const contributions: ParsedContribution[] = []

  for (const line of lines) {
    const { text } = line
    // Rotation-results rows ("DPS: 559K" / "Dmg: ... Time: ...") are per-rotation
    // stats; the headline numbers already average them. Skip anything K/M-ish.
    const isRotationRow =
      /\bDmg\s*:/.test(text) || /\bDPS\s*:\s*[\d ,.]+[KM]\b/i.test(text)

    if (dps === undefined && !isRotationRow) {
      const m = text.match(/\bDPS\s*:\s*([\d][\d ,]*)(?![\d ,]*[KM])/)
      if (m) dps = num(m[1])
    }
    if (totalDamage === undefined && !isRotationRow) {
      const m = text.match(/\bDamage\s*:\s*([\d][\d ,]*)$/)
      if (m) totalDamage = num(m[1])
    }
    if (timeElapsedSec === undefined) {
      const m = text.match(/Time Elapsed\s*:\s*([\d]+(?:[.,]\d+)?)\s*s?/i)
      if (m) timeElapsedSec = Number.parseFloat(m[1].replace(',', '.'))
    }
    if (strongestHit === undefined) {
      const m = text.match(/Strongest Hit\s*:\s*([\d][\d ,]*)/i)
      if (m) strongestHit = num(m[1])
    }
    if (uid === undefined) {
      const withoutGuid = text.replace(/Stage GUID\s*:?\s*\d+/i, '')
      const m = withoutGuid.match(/\bUID\s*:?\s*(\d{5,12})\b/i)
      if (m) uid = m[1]
    }
    if (contributions.length < TEAM_SIZE && !isRotationRow) {
      const m = text.match(CONTRIBUTION_RE)
      if (m) {
        const damage = num(m[2])
        if (damage !== undefined) {
          const rawName = m[1].trim()
          const match = matchName(rawName, candidates)
          const duplicate = contributions.some(
            (c) =>
              c.rawName === rawName ||
              (match.character && c.character === match.character)
          )
          if (!duplicate) {
            if (!match.character)
              warnings.push(
                match.ambiguous
                  ? `"${rawName}" matches multiple characters - pick one manually`
                  : `Could not recognize character "${rawName}"`
              )
            contributions.push({
              character: match.character,
              rawName,
              damage,
              pct: Number.parseInt(m[3], 10),
            })
          }
        }
      }
    }
  }

  // Team: contribution characters first, then names on the right rail.
  const team: (CharacterKey | undefined)[] = []
  for (const c of contributions)
    if (c.character && !team.includes(c.character)) team.push(c.character)

  if (team.length < TEAM_SIZE && lines.length) {
    const maxX = Math.max(...lines.map((l) => l.x + l.w))
    const railLines = lines.filter((l) => l.x > maxX * 0.7)
    for (const line of railLines) {
      if (team.length >= TEAM_SIZE) break
      const match = matchName(line.text, candidates)
      if (match.character && !team.includes(match.character))
        team.push(match.character)
    }
  }
  while (team.length < TEAM_SIZE) team.push(undefined)
  if (team.some((t) => t === undefined))
    warnings.push(
      'Could not identify all 4 team members - fill them in manually'
    )

  if (dps === undefined) warnings.push('DPS not found in the screenshot')
  if (totalDamage === undefined)
    warnings.push('Total damage not found in the screenshot')

  if (totalDamage !== undefined && contributions.length === TEAM_SIZE) {
    const sum = contributions.reduce((a, c) => a + c.damage, 0)
    if (Math.abs(sum - totalDamage) > totalDamage * 0.05)
      warnings.push(
        'Per-character damage does not add up to the total - check for misreads'
      )
  }
  if (
    dps !== undefined &&
    totalDamage !== undefined &&
    timeElapsedSec !== undefined &&
    timeElapsedSec > 0 &&
    Math.abs(dps * timeElapsedSec - totalDamage) > totalDamage * 0.05
  )
    warnings.push(
      'DPS x time does not match the total damage - check for misreads'
    )

  return {
    dps,
    totalDamage,
    contributions,
    timeElapsedSec,
    strongestHit,
    uid,
    team: team.slice(0, TEAM_SIZE),
    warnings,
  }
}
