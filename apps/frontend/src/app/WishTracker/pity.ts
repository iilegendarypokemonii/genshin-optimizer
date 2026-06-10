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
}

export function sortWishes(wishes: Wish[]): Wish[] {
  return [...wishes].sort((a, b) =>
    a.time === b.time ? a.id.localeCompare(b.id) : a.time.localeCompare(b.time)
  )
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
    })
  }
  return stats
}
