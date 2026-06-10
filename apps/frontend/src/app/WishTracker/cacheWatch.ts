import { AuthkeyExpiredError, fetchNewWishes, probeAuthkey } from './fetcher'
import { getGameDir } from './gameDirSetting'
import { getWishStore, mergeWishes } from './storage'
import type { CacheKeyState } from './types'

const KEY_STATE_LS = 'wishTracker:keyState'
const LAST_SYNC_LS_PREFIX = 'wishTracker:lastSync:'
/** Stop trusting a once-valid key after this long; probe it again instead. */
const KEY_TRUST_MS = 23 * 60 * 60 * 1000

export type WishUrlResult = {
  url: string
  cacheMtimeMs: number
  gameDir: string
}
export type WishCacheErr = { kind: string; message: string }

export type SyncOutcome =
  /** Cache file / game dir problem — message explains what to do. */
  | { kind: 'no-cache'; errKind: string; message: string }
  /** Key in cache is expired; user must open wish history in-game. */
  | { kind: 'expired' }
  /** Known-expired key unchanged since last attempt; nothing was tried. */
  | { kind: 'skipped' }
  /** Synced an existing profile. */
  | { kind: 'synced'; uid: string; added: number; expiredMidFetch: boolean }
  /** Valid key, but the account has no wishes at all. */
  | { kind: 'no-wishes' }
  /** Valid key for a UID with no profile — ask the user before full fetch. */
  | { kind: 'new-uid'; uid: string }
  | { kind: 'error'; message: string }

export function loadKeyState(): CacheKeyState | undefined {
  try {
    const raw = localStorage.getItem(KEY_STATE_LS)
    return raw ? (JSON.parse(raw) as CacheKeyState) : undefined
  } catch {
    return undefined
  }
}

function saveKeyState(state: CacheKeyState) {
  localStorage.setItem(KEY_STATE_LS, JSON.stringify(state))
}

export function getLastSyncMs(uid: string): number | undefined {
  const raw = localStorage.getItem(`${LAST_SYNC_LS_PREFIX}${uid}`)
  return raw ? Number(raw) : undefined
}

function setLastSyncMs(uid: string) {
  localStorage.setItem(`${LAST_SYNC_LS_PREFIX}${uid}`, String(Date.now()))
}

async function readCacheUrl(): Promise<WishUrlResult> {
  const { invoke } = await import('@tauri-apps/api/core')
  return await invoke<WishUrlResult>('get_wish_url', {
    gameDir: getGameDir() ?? null,
  })
}

function isWishCacheErr(e: unknown): e is WishCacheErr {
  return !!e && typeof e === 'object' && 'kind' in e && 'message' in e
}

export type SyncOptions = {
  /** Manual refresh: re-probe even a known-expired key. */
  force?: boolean
  /** User confirmed creating a profile for this UID — allows the full fetch. */
  approvedNewUid?: string
}

let inflight: Promise<SyncOutcome> | null = null

/**
 * The cache-watch core. Reads the game cache URL, classifies the key against
 * remembered state, and runs an incremental sync when warranted. Never makes
 * a network call for a key already known to be expired (unless force).
 * Single-flight: concurrent callers join the in-progress run.
 */
export function checkAndSync(opts: SyncOptions = {}): Promise<SyncOutcome> {
  if (inflight) return inflight
  inflight = doCheckAndSync(opts).finally(() => {
    inflight = null
  })
  return inflight
}

async function doCheckAndSync(opts: SyncOptions): Promise<SyncOutcome> {
  let cache: WishUrlResult
  try {
    cache = await readCacheUrl()
  } catch (e) {
    if (isWishCacheErr(e))
      return { kind: 'no-cache', errKind: e.kind, message: e.message }
    return { kind: 'error', message: String(e) }
  }

  const prev = loadKeyState()
  const sameKey = prev?.url === cache.url
  const now = Date.now()

  if (sameKey && prev.status === 'expired' && !opts.force)
    return { kind: 'skipped' }

  // Identify the account. Trust a recent successful probe of the same key;
  // otherwise spend one cheap page on it.
  let uid = sameKey ? prev.uid : undefined
  const trusted =
    sameKey &&
    prev.status === 'valid' &&
    prev.lastValidAt !== undefined &&
    now - prev.lastValidAt < KEY_TRUST_MS

  const baseState: CacheKeyState = {
    url: cache.url,
    status: 'unknown',
    uid,
    cacheMtimeMs: cache.cacheMtimeMs,
    lastValidAt: trusted ? prev.lastValidAt : undefined,
  }

  if (!uid || !trusted) {
    try {
      uid = await probeAuthkey(cache.url)
      saveKeyState({
        ...baseState,
        status: 'valid',
        uid,
        lastValidAt: now,
        probedAt: now,
      })
    } catch (e) {
      if (e instanceof AuthkeyExpiredError) {
        saveKeyState({ ...baseState, status: 'expired', probedAt: now })
        return { kind: 'expired' }
      }
      saveKeyState({ ...baseState, status: 'unknown', probedAt: now })
      return { kind: 'error', message: String(e) }
    }
    if (!uid) return { kind: 'no-wishes' }
  }

  const store = getWishStore()
  const existing = await store.load(uid) // CorruptFileError propagates to caller
  if (!existing && opts.approvedNewUid !== uid) return { kind: 'new-uid', uid }

  const knownIds = new Set((existing?.wishes ?? []).map((w) => w.id))
  let result
  try {
    result = await fetchNewWishes(cache.url, knownIds)
  } catch (e) {
    if (e instanceof AuthkeyExpiredError) {
      saveKeyState({ ...baseState, status: 'expired', uid, probedAt: now })
      return { kind: 'expired' }
    }
    return { kind: 'error', message: String(e) }
  }

  saveKeyState({
    ...baseState,
    status: result?.expiredMidFetch ? 'expired' : 'valid',
    uid,
    lastValidAt: now,
    probedAt: now,
  })

  if (!result) return { kind: 'no-wishes' }
  if (result.uid !== uid)
    return {
      kind: 'error',
      message: `Authkey identified as UID ${uid} but returned wishes for ${result.uid}; aborted.`,
    }

  if (result.newWishes.length || !existing) {
    const { wishes, added } = mergeWishes(
      existing?.wishes ?? [],
      result.newWishes,
      uid
    )
    await store.save(uid, wishes)
    setLastSyncMs(uid)
    return {
      kind: 'synced',
      uid,
      added,
      expiredMidFetch: result.expiredMidFetch,
    }
  }
  setLastSyncMs(uid)
  return {
    kind: 'synced',
    uid,
    added: 0,
    expiredMidFetch: result.expiredMidFetch,
  }
}
