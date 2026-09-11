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
  /** Reaction tracker summary, e.g. "Chasca: Melt x23, Swirl x15; Durin: Melt x10" */
  reactions?: string
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
  let digits = raw.replace(/[\s,]/g, '')
  if (!/^\d+$/.test(digits)) return undefined
  // two passes reading the same number side by side concatenate it
  // ("262 047 262 047" -> "262047262047"); collapse exact doubles
  if (
    digits.length >= 8 &&
    digits.length % 2 === 0 &&
    digits.slice(0, digits.length / 2) === digits.slice(digits.length / 2)
  )
    digits = digits.slice(0, digits.length / 2)
  const n = Number(digits)
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

  // Windows OCR frequently reads a capital I as a lowercase L ("lansan")
  if (target.startsWith('l')) {
    const swapped = 'i' + target.slice(1)
    const swapExact = uniq(
      candidates.filter((c) => c.norm === swapped).map((c) => c.character)
    )
    if (swapExact.length === 1) return { character: swapExact[0] }
  }

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
/** Exported for the dump-debug harness only. */
export function buildRows(lines: OcrLine[], gapThreshold: number): Row[] {
  // Cluster by vertical-center distance against a fixed anchor (the first
  // member). Anchored centers cannot drift, so one tall OCR box spanning two
  // visual rows can no longer chain adjacent rows together.
  interface Cluster {
    cy: number
    h: number
    members: OcrLine[]
  }
  const clusters: Cluster[] = []
  for (const line of [...lines].sort((a, b) => a.y - b.y)) {
    const cy = line.y + line.h / 2
    const host = clusters.find(
      (c) => Math.abs(cy - c.cy) <= 0.7 * Math.min(line.h, c.h)
    )
    if (host) host.members.push(line)
    else clusters.push({ cy, h: line.h, members: [line] })
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
        y: Math.min(...segment.map((l) => l.y)),
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

const REACTION_WORDS = [
  'Melt',
  'Vaporize',
  'Swirl',
  'Frozen',
  'Superconduct',
  'Overloaded',
  'Electro-Charged',
  'Crystallize',
  'Burning',
  'Bloom',
  'Hyperbloom',
  'Burgeon',
  'Aggravate',
  'Spread',
  'Quicken',
  'Shatter',
  'Lunar-Charged',
  'Lunar Bloom',
] as const

function matchReactionWord(token: string): string | undefined {
  const t = normName(token)
  if (t.length < 4) return undefined
  for (const word of REACTION_WORDS) {
    const w = normName(word)
    if (t === w) return word
    if (w.length >= 4 && levenshtein(t, w) <= 1) return word
  }
  return undefined
}

/** "x15", "XIO" (x10), "XII" (x11) -> count. Requires the x prefix. */
function reactionCount(token: string): number | undefined {
  if (!/^[xX×]/.test(token)) return undefined
  const m = token.match(/^[xX×]([0-9IlOo]{1,4})$/)
  if (!m) return undefined
  const digits = m[1].replace(/[Il]/g, '1').replace(/[Oo]/g, '0')
  const n = Number(digits)
  return Number.isFinite(n) && n > 0 && n < 1000 ? n : undefined
}

/** Read the Reaction Tracker panel into a compact per-character summary. */
function extractReactions(
  rows: Row[],
  candidates: NameCandidate[],
  nameMap: CharNameMap
): string | undefined {
  const perChar = new Map<CharacterKey, Map<string, number | undefined>>()
  for (const row of rows) {
    const colon = row.text.indexOf(':')
    if (colon < 2 || colon > 20) continue
    const nameMatch = matchName(row.text.slice(0, colon), candidates)
    if (!nameMatch.character) continue
    const tokens = row.text
      .slice(colon + 1)
      .trim()
      .split(/\s+/)
    const found =
      perChar.get(nameMatch.character) ?? new Map<string, number | undefined>()
    let current: string | undefined
    for (const token of tokens) {
      const word = matchReactionWord(token)
      if (word) {
        current = word
        if (!found.has(word)) found.set(word, undefined)
        continue
      }
      const count = reactionCount(token)
      if (count !== undefined && current) {
        const prev = found.get(current)
        found.set(current, prev === undefined ? count : Math.max(prev, count))
        current = undefined
      }
    }
    if (found.size) perChar.set(nameMatch.character, found)
  }
  if (!perChar.size) return undefined
  const parts: string[] = []
  for (const [ck, reactions] of perChar) {
    const list = [...reactions]
      .map(([word, count]) =>
        count !== undefined ? `${word} x${count}` : word
      )
      .join(', ')
    parts.push(`${nameMap[ck] ?? ck}: ${list}`)
  }
  return parts.join('; ')
}

// "Chasca : 23498282(76%)" / 'Mona 264923 (2")' / "Citlali : 101493 (1%".
// Deliberately not end-anchored: OCR boxes spanning two visual rows can glue
// rotation fragments after the percent, which must not invalidate the row.
const CONTRIB_WITH_PCT = /^(.{2,30}?)\s*[:.]?\s*(\d[\d,]{2,})\s*\(\s*(\d{1,3})/
// "Durin : 3242493" - only trusted when the name matches a character
const CONTRIB_NO_PCT = /^(.{2,30}?)\s*[:.]\s*(\d[\d,]{3,})\s*$/
// "Citlali 1014930%)-": the percent glued onto the damage when "(" is lost;
// resolved later by validating the split against the total damage
const CONTRIB_GLUED = /^(.{2,30}?)\s*[:.]?\s*(\d{5,9})\s*[%o)]/

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
  let dpsRowY: number | undefined
  let timeLabelRowY: number | undefined
  const bareNumberRows: { y: number; value: number }[] = []
  const secondsRows: { y: number; value: number }[] = []
  const contributions: ParsedContribution[] = []
  const gluedRows: { character: CharacterKey; digits: string }[] = []
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
      if (m) {
        dps = num(m[1])
        dpsRowY = row.y
      }
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
      // tolerate garbled labels: "Time Eltap-sgd", "jPiine Elapsed", bullets
      const m = text.match(
        /\b(?:Time\s*E\w*|Elapsed)[^\d]{0,10}(\d{1,3}(?:[.,]\d{1,2})?)/i
      )
      if (m) timeElapsedSec = Number.parseFloat(m[1].replace(',', '.'))
      else if (/\b(?:Time\s*E\w+|Elapsed)/i.test(text)) timeLabelRowY = row.y
    }
    {
      // lone decimal-seconds rows ("52.7*", "64.85 s") for the time fallback
      const secs = text.match(
        /^[^A-Za-z]{0,2}(\d{1,3}[.,]\d{1,2})\s*s?\W{0,3}$/
      )
      if (secs)
        secondsRows.push({
          y: row.y,
          value: Number.parseFloat(secs[1].replace(',', '.')),
        })
      // bare large numbers ("13492769") for the total-damage fallback
      if (
        !isRotationRow &&
        !/\(\s*\d{1,3}\s*[%")]/.test(text) &&
        !/UID/i.test(text)
      ) {
        // a >=7-digit run survives even when the "Damage :" label is garbled
        const bare = text.match(/(\d{7,})/)
        if (bare) {
          const value = num(bare[1])
          if (value !== undefined) bareNumberRows.push({ y: row.y, value })
        }
      }
    }
    if (strongestHit === undefined) {
      const m = text.match(/\bHits?\b[^\d]{0,4}(\d[\d ,]*)/i)
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
        if (rawName === undefined) {
          const glued = contribText.match(CONTRIB_GLUED)
          if (glued) {
            const m = matchName(glued[1].trim(), candidates)
            if (m.character)
              gluedRows.push({ character: m.character, digits: glued[2] })
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

  // The total-damage value sits directly under the DPS row; when its label is
  // garbled or lost, trust the first bare large number below the DPS row.
  if (totalDamage === undefined && bareNumberRows.length) {
    const below =
      dpsRowY !== undefined
        ? bareNumberRows.filter(
            (r) => r.y > (dpsRowY as number) && r.y - (dpsRowY as number) < 220
          )
        : bareNumberRows
    const first = [...below].sort((a, b) => a.y - b.y)[0]
    if (first) totalDamage = first.value
  }
  // Same for elapsed time: a lone decimal-seconds row next to its label.
  if (timeElapsedSec === undefined && timeLabelRowY !== undefined) {
    const near = secondsRows
      .filter((r) => Math.abs(r.y - (timeLabelRowY as number)) <= 45)
      .sort(
        (a, b) =>
          Math.abs(a.y - (timeLabelRowY as number)) -
          Math.abs(b.y - (timeLabelRowY as number))
      )[0]
    if (near) timeElapsedSec = near.value
  }

  // Resolve glued damage+percent reads ("1014930%") by trying both splits
  // and validating the implied percentage against the total damage.
  if (totalDamage !== undefined && totalDamage > 0) {
    for (const glued of gluedRows) {
      if (contributions.length >= TEAM_SIZE) break
      if (contributions.some((c) => c.character === glued.character)) continue
      let best: { damage: number; pct: number; diff: number } | undefined
      for (const take of [1, 2]) {
        const dmgStr = glued.digits.slice(0, -take)
        if (dmgStr.length < 3) continue
        const damage = Number(dmgStr)
        const pct = Number(glued.digits.slice(-take))
        const diff = Math.abs((damage / totalDamage) * 100 - pct)
        if (pct <= 100 && diff <= 1.6 && (!best || diff < best.diff))
          best = { damage, pct, diff }
      }
      if (best)
        contributions.push({
          character: glued.character,
          rawName: nameMap[glued.character] ?? glued.character,
          damage: best.damage,
          pct: best.pct,
        })
    }
  }

  // raw lines, not merged rows: tracker entries share heights with the
  // attribute panel and would otherwise hide behind its first colon
  const reactions = extractReactions(lines, candidates, nameMap)

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
    reactions,
    team: team.slice(0, TEAM_SIZE),
    warnings,
  }
}
