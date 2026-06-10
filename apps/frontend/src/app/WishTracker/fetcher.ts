import type { Wish } from './types'
import { FETCH_BANNERS } from './types'

/**
 * Politeness rules below (page spacing, bounded backoff, caller-side
 * never-retry-expired-keys) are load-bearing: they keep this indistinguishable
 * from normal in-game wish-history usage. Do not "optimize" them away.
 */
const PAGE_DELAY_MS = 600
const RATE_LIMIT_BACKOFFS_MS = [3000, 6000, 12000]
const PAGE_SIZE = 20

export class AuthkeyExpiredError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthkeyExpiredError'
  }
}

export class GachaApiError extends Error {
  constructor(
    public retcode: number,
    message: string
  ) {
    super(`Gacha API error ${retcode}: ${message}`)
    this.name = 'GachaApiError'
  }
}

type GachaResponse = {
  retcode: number
  message: string
  data: { list: Wish[] } | null
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function buildPageUrl(
  baseUrl: string,
  gachaType: string,
  endId: string
): string {
  const url = new URL(baseUrl)
  url.searchParams.set('gacha_type', gachaType)
  url.searchParams.set('size', String(PAGE_SIZE))
  url.searchParams.set('end_id', endId)
  url.searchParams.set('lang', 'en')
  return url.toString()
}

/** Tauri-only: routed through plugin-http because the API sends no CORS headers. */
async function fetchPage(
  baseUrl: string,
  gachaType: string,
  endId: string
): Promise<GachaResponse> {
  const { fetch: httpFetch } = await import('@tauri-apps/plugin-http')
  const resp = await httpFetch(buildPageUrl(baseUrl, gachaType, endId), {
    method: 'GET',
    connectTimeout: 30_000,
  })
  if (!resp.ok) throw new GachaApiError(resp.status, `HTTP ${resp.status}`)
  return (await resp.json()) as GachaResponse
}

async function fetchPageChecked(
  baseUrl: string,
  gachaType: string,
  endId: string
): Promise<Wish[]> {
  let resp = await fetchPage(baseUrl, gachaType, endId)
  for (const backoffMs of RATE_LIMIT_BACKOFFS_MS) {
    if (resp.retcode !== -110) break // -110 = "visit too frequently"
    await sleep(backoffMs)
    resp = await fetchPage(baseUrl, gachaType, endId)
  }
  if (resp.retcode !== 0) {
    if (
      resp.retcode === -101 ||
      resp.retcode === -100 ||
      resp.message?.toLowerCase().includes('authkey')
    ) {
      throw new AuthkeyExpiredError(resp.message)
    }
    throw new GachaApiError(resp.retcode, resp.message ?? '?')
  }
  return resp.data?.list ?? []
}

/**
 * Cheap validity/identity probe: one page, first banner that has any wishes.
 * Returns the UID the authkey belongs to, or undefined for an account with
 * zero wishes. Throws AuthkeyExpiredError when the key is dead.
 */
export async function probeAuthkey(
  baseUrl: string
): Promise<string | undefined> {
  for (const gachaType of FETCH_BANNERS) {
    const items = await fetchPageChecked(baseUrl, gachaType, '0')
    const uid = items.find((w) => w.uid)?.uid
    if (uid) return uid
    await sleep(PAGE_DELAY_MS)
  }
  return undefined
}

export type FetchProgress = {
  bannerName: string
  page: number
  newCount: number
}

export type FetchResult = {
  uid: string
  /** Records not present in knownIds, across all banners. */
  newWishes: Wish[]
  /** True when the authkey died mid-fetch; newWishes holds the pages that
   * completed before that (safe to merge — merge is by id). */
  expiredMidFetch: boolean
}

/**
 * Incremental fetch across all banners: pages newest-to-oldest and stops a
 * banner once a page contains an already-known id (or a short page).
 * With an empty knownIds set this fetches the full server-side history.
 */
export async function fetchNewWishes(
  baseUrl: string,
  knownIds: ReadonlySet<string>,
  onProgress?: (p: FetchProgress) => void
): Promise<FetchResult | undefined> {
  let uid: string | undefined
  const newWishes: Wish[] = []
  let expiredMidFetch = false

  outer: for (const gachaType of FETCH_BANNERS) {
    let endId = '0'
    let page = 0
    for (;;) {
      let items: Wish[]
      try {
        items = await fetchPageChecked(baseUrl, gachaType, endId)
      } catch (e) {
        if (e instanceof AuthkeyExpiredError && newWishes.length) {
          expiredMidFetch = true
          break outer // keep what we have; caller merges and reports
        }
        throw e
      }
      if (!items.length) break
      page += 1
      let reachedKnown = false
      for (const item of items) {
        if (!uid && item.uid) uid = item.uid
        if (knownIds.has(item.id)) reachedKnown = true
        else newWishes.push(item)
      }
      onProgress?.({ bannerName: gachaType, page, newCount: newWishes.length })
      if (reachedKnown || items.length < PAGE_SIZE) break
      endId = items[items.length - 1].id
      await sleep(PAGE_DELAY_MS)
    }
  }

  if (!uid) return undefined // account with no wishes at all
  return { uid, newWishes, expiredMidFetch }
}
