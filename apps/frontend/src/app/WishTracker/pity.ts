import type { Wish } from './types'
import { BANNER_GROUPS, bannerKey } from './types'

export type FiveStarPull = {
  wish: Wish
  /** Number of wishes this 5★ took, counting from the previous 5★ (1-based). */
  pity: number
}

export type BannerStats = {
  key: string
  name: string
  total: number
  /** Ascending by (time, id); newest last. */
  fiveStars: FiveStarPull[]
  currentPity5: number
  currentPity4: number
  /** 0 when there is no 5★ yet. */
  avgPity5: number
  fiveStarCount: number
  fourStarCount: number
  primosSpent: number
  /** Theoretical hidden Capturing Radiance score, only for Character Event. */
  capturingRadianceScore?: number
  /** Normal featured-character guarantee after an off-banner Character Event 5-star. */
  featuredCharacterGuaranteed?: boolean
}

const CAPTURING_RADIANCE_START = '2024-08-28 00:00:00'
const STANDARD_FIVE_STAR_CHARACTERS = new Set([
  'Jean',
  'Diluc',
  'Mona',
  'Qiqi',
  'Keqing',
  'Tighnari',
  'Dehya',
  'Yumemizuki Mizuki',
])

export function sortWishes(wishes: Wish[]): Wish[] {
  return [...wishes].sort((a, b) =>
    a.time === b.time ? a.id.localeCompare(b.id) : a.time.localeCompare(b.time)
  )
}

/**
 * Community-model Capturing Radiance score requested for this tracker:
 * starts at 1 when the mechanic was introduced; a standard-character loss on
 * a non-guaranteed Character Event 5★ adds 1, capped at 3, and an ordinary
 * featured win removes 1 with a floor of 0. A player-confirmed Capturing
 * Radiance resets the score to 1. The guaranteed featured pull immediately
 * following a loss is neutral. This follows Hu Tao's "hypothese A" model.
 */
export function computeCapturingRadianceScore(wishes: Wish[]): number {
  const eventFiveStars = sortWishes(wishes).filter(
    (wish) =>
      (wish.gacha_type === '301' || wish.gacha_type === '400') &&
      wish.rank_type === '5' &&
      wish.item_type === 'Character' &&
      wish.time >= CAPTURING_RADIANCE_START
  )

  let score = 1
  let featuredGuaranteed = false
  for (const wish of eventFiveStars) {
    if (STANDARD_FIVE_STAR_CHARACTERS.has(wish.name)) {
      score = Math.min(3, score + 1)
      featuredGuaranteed = true
    } else if (wish.capturingRadiance) {
      score = 1
      featuredGuaranteed = false
    } else if (featuredGuaranteed) {
      featuredGuaranteed = false
    } else {
      score = Math.max(0, score - 1)
    }
  }
  return score
}

/** Hu Tao calculator's theoretical chance for the next non-guaranteed 5-star. */
export function capturingRadianceWinChance(score: number): 50 | 55 | 100 {
  if (score >= 3) return 100
  if (score >= 2) return 55
  return 50
}

/**
 * Per-banner-group pity stats. Mirrors make_report.py exactly:
 * 301 and 400 are grouped under one shared pity counter.
 * Groups with zero wishes are omitted.
 */
export function computeBannerStats(wishes: Wish[]): BannerStats[] {
  const sorted = sortWishes(wishes)
  const groups = new Map<string, Wish[]>()
  for (const w of sorted) {
    const key = bannerKey(w)
    const group = groups.get(key)
    if (group) group.push(w)
    else groups.set(key, [w])
  }

  const stats: BannerStats[] = []
  for (const { key, name } of BANNER_GROUPS) {
    const bw = groups.get(key)
    if (!bw?.length) continue

    const fiveStars: FiveStarPull[] = []
    let pity = 0
    for (const w of bw) {
      pity += 1
      if (w.rank_type === '5') {
        fiveStars.push({ wish: w, pity })
        pity = 0
      }
    }
    const currentPity5 = pity

    let currentPity4 = 0
    for (let i = bw.length - 1; i >= 0; i--) {
      if (bw[i].rank_type === '4' || bw[i].rank_type === '5') break
      currentPity4 += 1
    }

    const avgPity5 = fiveStars.length
      ? fiveStars.reduce((sum, f) => sum + f.pity, 0) / fiveStars.length
      : 0

    stats.push({
      key,
      name,
      total: bw.length,
      fiveStars,
      currentPity5,
      currentPity4,
      avgPity5,
      fiveStarCount: fiveStars.length,
      fourStarCount: bw.filter((w) => w.rank_type === '4').length,
      primosSpent: bw.length * 160,
      capturingRadianceScore:
        key === '301' ? computeCapturingRadianceScore(wishes) : undefined,
      featuredCharacterGuaranteed:
        key === '301'
          ? STANDARD_FIVE_STAR_CHARACTERS.has(
              fiveStars[fiveStars.length - 1]?.wish.name ?? ''
            )
          : undefined,
    })
  }
  return stats
}
