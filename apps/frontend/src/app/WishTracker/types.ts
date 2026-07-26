/** A single wish record, kept verbatim in the HoYoverse API shape. */
export type Wish = {
  uid: string
  gacha_type: string
  item_id: string
  count: string
  /** 'YYYY-MM-DD HH:mm:ss' in server-local time */
  time: string
  name: string
  lang: string
  item_type: string
  rank_type: string
  id: string
  /** 'paimonmoe' on rows imported from a paimon.moe xlsx (synthetic ids) */
  source?: string
  /**
   * Local-only annotation. The HoYoverse Wish History API does not expose
   * whether Capturing Radiance triggered, so this can only be set when the
   * player confirms seeing the in-game effect.
   */
  capturingRadiance?: {
    source: 'player-confirmed'
    confirmedAt: string
  }
}

/** On-disk file shape, identical to the standalone pipeline's wishes_<uid>.json */
export type WishFile = {
  uid: string
  exported: string
  wishes: Wish[]
}

/**
 * Banner types the API accepts as gacha_type query values.
 * 400 (second character event banner) is NOT queried directly — its wishes
 * come back inside the 301 query, with item gacha_type '400'.
 */
export const FETCH_BANNERS = ['100', '200', '301', '302', '500'] as const

/** 301 and 400 share one pity counter. */
export function bannerKey(wish: Wish): string {
  return wish.gacha_type === '400' ? '301' : wish.gacha_type
}

/** Pity-group display order and names. */
export const BANNER_GROUPS: { key: string; name: string }[] = [
  { key: '301', name: 'Character Event' },
  { key: '302', name: 'Weapon Event' },
  { key: '200', name: 'Standard' },
  { key: '500', name: 'Chronicled' },
  { key: '100', name: 'Beginner' },
]

export const BANNER_NAME: Record<string, string> = Object.fromEntries([
  ...BANNER_GROUPS.map(({ key, name }) => [key, name]),
  ['400', 'Character Event'],
])

export type CacheKeyStatus = 'unknown' | 'valid' | 'expired'

/** Remembered state of the last authkey URL seen in the game cache. */
export type CacheKeyState = {
  url: string
  status: CacheKeyStatus
  /** UID the key belongs to; known after the first successful probe. */
  uid?: string
  /** When the key was last successfully used (ms epoch). */
  lastValidAt?: number
  /** When we last probed it (ms epoch). */
  probedAt?: number
  cacheMtimeMs?: number
}
