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
  /** Up to 4 team members: contribution characters first, then other recognized names. */
  team: (CharacterKey | undefined)[]
  warnings: string[]
}

export const TEAM_SIZE = 4

/** Normalize an OCR line: diacritics, exotic spaces, fullwidth colon, collapsed whitespace. */
function normalizeLine(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
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

interface Row {
  text: string
  x: number
  y: number
}

/**
 * Windows OCR returns HUD labels and their values as separate lines
 * ("DPS :" and "589 311"). Rebuild visual rows: cluster lines whose vertical
 * ranges overlap by more than half the smaller height, then split clusters at
 * large horizontal gaps (left HUD vs right character rail).
 */
function buildRows(lines: OcrLine[], gapThreshold: number): Row[] {
  interface Cluster {
    y0: number
    y1: number
    members: OcrLine[]
  }
  const clusters: Cluster[] = []
  for (const line of [...lines].sort((a, b) => a.y - b.y)) {
    const y0 = line.y
    const y1 = line.y + line.h
    const host = clusters.find((c) => {
      const overlap = Math.min(c.y1, y1) - Math.max(c.y0, y0)
      return overlap > 0.5 * Math.min(y1 - y0, c.y1 - c.y0)
    })
    if (host) {
      host.members.push(line)
      host.y0 = Math.min(host.y0, y0)
      host.y1 = Math.max(host.y1, y1)
    } else {
      clusters.push({ y0, y1, members: [line] })
    }
  }
  const rows: Row[] = []
  for (const cluster of clusters) {
    const members = [...cluster.members].sort((a, b) => a.x - b.x)
    let segment: OcrLine[] = []
    const flush = () => {
      if (!segment.length) return
      rows.push({
        text: segment.map((l) => l.text).join(' '),
        x: segment[0].x,
        y: cluster.y0,
      })
      segment = []
    }
    for (const member of members) {
      const last = segment[segment.length - 1]
      if (last && member.x - (last.x + last.w) > gapThreshold) flush()
      segment.push(member)
    }
    flush()
  }
  return rows.sort((a, b) => a.y - b.y || a.x - b.x)
}

// "Chasca : 23498282(76%)" / 'Mona 264923 (2")' / "Citlali : 101493 (1%" (broken paren)
const CONTRIB_WITH_PCT =
  /^(.{2,30}?)\s*[:.]?\s*(\d[\d,]{2,})\s*\(\s*(\d{1,3})[^)]*(?:\).{0,6})?$/
// "Durin : 3242493" - only trusted when the name matches a character
const CONTRIB_NO_PCT = /^(.{2,30}?)\s*[:.]\s*(\d[\d,]{3,})\s*$/

export function parseOcrLines(
  rawLines: OcrLine[],
  nameMap: CharNameMap
): ParsedScreenshot {
  const warnings: string[] = []
  const candidates = buildCandidates(nameMap)
  const lines = rawLines
    .map((l) => ({ ...l, text: normalizeLine(l.text) }))
    .filter((l) => l.text)
    .sort((a, b) => a.y - b.y || a.x - b.x)

  const maxX = lines.length ? Math.max(...lines.map((l) => l.x + l.w)) : 0
  const rows = buildRows(lines, Math.max(250, maxX * 0.12))

  let dps: number | undefined
  let totalDamage: number | undefined
  let timeElapsedSec: number | undefined
  let strongestHit: number | undefined
  let uid: string | undefined
  const contributions: ParsedContribution[] = []
  const teamCandidates: {
    character: CharacterKey
    y: number
    left: boolean
  }[] = []

  for (const row of rows) {
    const { text } = row
    // Rotation-results rows ("DPS: 559K" / "Dmg: ... Time: ...") are per-rotation
    // stats; the headline numbers already average them.
    const isRotationRow =
      /\bDmg\s*:/.test(text) ||
      /\bDPS\b[^\d]{0,4}[\d ,.]+[KM]\b/i.test(text) ||
      (/\bTime\s*:/i.test(text) && !/Elapsed/i.test(text))

    if (dps === undefined && !isRotationRow) {
      const m = text.match(/\bDPS\b[^\d]{0,4}(\d{1,3}(?:[ ,]\d{3})+|\d{2,})/)
      if (m) dps = num(m[1])
    }
    if (
      totalDamage === undefined &&
      !isRotationRow &&
      !/CRIT|Bonus/i.test(text)
    ) {
      // tolerate garbled labels ("Damagae.") and merged trailing text
      const m = text.match(/\bDamag\w{0,2}[^\d]{0,6}(\d[\d,]{3,})/)
      if (m) totalDamage = num(m[1])
    }
    if (timeElapsedSec === undefined) {
      const m = text.match(/Time\s*Elapsed[^\d]{0,4}(\d+(?:[.,]\d+)?)/i)
      if (m) timeElapsedSec = Number.parseFloat(m[1].replace(',', '.'))
    }
    if (strongestHit === undefined) {
      const m = text.match(/\bHit\b[^\d]{0,4}(\d[\d ,]*)/i)
      if (m) strongestHit = num(m[1])
    }
    if (uid === undefined) {
      const withoutGuid = text.replace(/Stage GUID\b[^\d]{0,4}\d+/i, '')
      const m = withoutGuid.match(/\bUID\b[^\d]{0,4}(\d{5,12})\b/i)
      if (m) uid = m[1]
    }
    // rotation-results fragments can merge into contribution rows when OCR
    // boxes span both columns; excise them instead of skipping the whole row
    const contribText = text
      .replace(/\bDPS\b[^\d]{0,4}[\d ,.]+[KM]\b.*$/i, '')
      .replace(/\bDmg\s*:.*$/i, '')
      .replace(/\bTime\s*:\s*[\d.,]+s?.*$/i, '')
      .trim()
    if (contributions.length < TEAM_SIZE && contribText) {
      let rawName: string | undefined
      let damage: number | undefined
      let pct: number | undefined
      let match: NameMatch | undefined
      const withPct = contribText.match(CONTRIB_WITH_PCT)
      // a digits-only "name" is an orphaned value line whose label was
      // missed by OCR; do not guess which character it belongs to
      if (withPct && !/^[\d ,.]*$/.test(withPct[1])) {
        rawName = withPct[1].trim()
        damage = num(withPct[2])
        pct = Number.parseInt(withPct[3], 10)
        match = matchName(rawName, candidates)
      } else {
        const noPct = contribText.match(CONTRIB_NO_PCT)
        if (noPct) {
          const m = matchName(noPct[1].trim(), candidates)
          // without a percent, only trust rows naming a known character
          if (m.character) {
            rawName = noPct[1].trim()
            damage = num(noPct[2])
            match = m
          }
        }
      }
      if (rawName !== undefined && damage !== undefined && match) {
        const matchedCharacter = match.character
        const duplicate = contributions.some(
          (c) =>
            c.rawName === rawName ||
            (matchedCharacter && c.character === matchedCharacter)
        )
        if (!duplicate) {
          if (!matchedCharacter)
            warnings.push(
              match.ambiguous
                ? `"${rawName}" matches multiple characters - pick one manually`
                : `Could not recognize character "${rawName}"`
            )
          contributions.push({
            character: matchedCharacter,
            rawName,
            damage,
            ...(pct !== undefined ? { pct } : {}),
          })
          if (matchedCharacter)
            teamCandidates.push({
              character: matchedCharacter,
              y: row.y,
              left: true,
            })
        }
      }
    }
  }

  // Team: gather every line naming a character. The damage panel, reaction
  // tracker, and right rail each list members in party order top-to-bottom,
  // so sorting left-panel hits by y (then rail hits by y) preserves the
  // in-game order even when some value lines were missed.
  for (const line of lines) {
    if (line.text.length > 30) continue
    const match = matchName(line.text, candidates)
    if (match.character)
      teamCandidates.push({
        character: match.character,
        y: line.y,
        left: line.x < maxX * 0.55,
      })
  }
  const inPartyOrder = [
    ...teamCandidates.filter((c) => c.left).sort((a, b) => a.y - b.y),
    ...teamCandidates.filter((c) => !c.left).sort((a, b) => a.y - b.y),
  ]
  const team: (CharacterKey | undefined)[] = []
  for (const c of inPartyOrder)
    if (!team.includes(c.character) && team.length < TEAM_SIZE)
      team.push(c.character)
  while (team.length < TEAM_SIZE) team.push(undefined)
  if (team.every((t) => t === undefined))
    warnings.push('No team members recognized - fill them in manually')

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
