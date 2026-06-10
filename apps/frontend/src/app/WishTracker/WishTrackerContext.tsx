import { isTauri } from '@genshin-optimizer/common/util'
import type { ReactNode } from 'react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { SyncOutcome } from './cacheWatch'
import { checkAndSync, getLastSyncMs, loadKeyState } from './cacheWatch'
import type { BannerStats } from './pity'
import { computeBannerStats } from './pity'
import { getWishStore, mergeWishes, validateWishFile } from './storage'
import type { CacheKeyState, WishFile } from './types'

const HOURLY_MS = 60 * 60 * 1000

export type WishProfile = {
  uid: string
  file: WishFile
  stats: BannerStats[]
  lastSyncMs?: number
}

export type WishTrackerValue = {
  isDesktop: boolean
  /** undefined while the initial load is in flight */
  profiles: WishProfile[] | undefined
  keyState?: CacheKeyState
  lastOutcome?: SyncOutcome
  syncing: boolean
  /** Profile-load or sync error worth surfacing (corrupt file etc.) */
  error?: string
  /** UID found in the cache with no profile yet */
  pendingUid?: string
  syncNow: () => Promise<void>
  /** Re-read the cache and identify the account in it, without syncing wishes. */
  checkCache: () => Promise<void>
  approvePendingUid: () => Promise<void>
  dismissPendingUid: () => void
  /** Create a wish profile for a UID (e.g. one previously dismissed) and full-fetch it. */
  createProfileFor: (uid: string) => Promise<void>
  importJson: (text: string) => Promise<{ uid: string; added: number }>
}

const WishTrackerContext = createContext<WishTrackerValue | undefined>(
  undefined
)

export function useWishTracker(): WishTrackerValue {
  const value = useContext(WishTrackerContext)
  if (!value) throw new Error('useWishTracker outside WishTrackerProvider')
  return value
}

export function WishTrackerProvider({ children }: { children: ReactNode }) {
  const desktop = isTauri()
  const [profiles, setProfiles] = useState<WishProfile[] | undefined>(undefined)
  const [keyState, setKeyState] = useState<CacheKeyState | undefined>(() =>
    loadKeyState()
  )
  const [lastOutcome, setLastOutcome] = useState<SyncOutcome | undefined>(
    undefined
  )
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [pendingUid, setPendingUid] = useState<string | undefined>(undefined)
  const dismissedUids = useRef(new Set<string>())

  const reloadProfiles = useCallback(async () => {
    const store = getWishStore()
    const loaded: WishProfile[] = []
    try {
      for (const uid of await store.listUids()) {
        const file = await store.load(uid)
        if (!file) continue
        loaded.push({
          uid,
          file,
          stats: computeBannerStats(file.wishes),
          lastSyncMs: getLastSyncMs(uid),
        })
      }
      setProfiles(loaded)
    } catch (e) {
      setProfiles(loaded)
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  const runSync = useCallback(
    async (opts: { force?: boolean; approvedNewUid?: string }) => {
      setSyncing(true)
      try {
        const outcome = await checkAndSync(opts)
        setLastOutcome(outcome)
        setKeyState(loadKeyState())
        // A dismissed UID stays quiet on auto-ticks, but an explicit manual
        // sync re-offers it — otherwise "Not now" is a dead end until relaunch.
        if (
          outcome.kind === 'new-uid' &&
          (opts.force || !dismissedUids.current.has(outcome.uid))
        ) {
          setPendingUid(outcome.uid)
        }
        if (outcome.kind === 'synced') {
          setError(undefined)
          await reloadProfiles()
        }
        if (outcome.kind === 'error') setError(outcome.message)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setSyncing(false)
      }
    },
    [reloadProfiles]
  )

  useEffect(() => {
    void reloadProfiles()
  }, [reloadProfiles])

  // App-wide cache-watch: on launch and hourly. The cheap path (re-reading
  // the local cache file) runs every tick; network only on new/valid keys.
  useEffect(() => {
    if (!desktop) return
    void runSync({})
    const interval = window.setInterval(() => void runSync({}), HOURLY_MS)
    return () => window.clearInterval(interval)
  }, [desktop, runSync])

  const syncNow = useCallback(async () => {
    await runSync({ force: true })
  }, [runSync])

  const checkCache = useCallback(async () => {
    await runSync({ identifyOnly: true })
  }, [runSync])

  const approvePendingUid = useCallback(async () => {
    if (!pendingUid) return
    const uid = pendingUid
    setPendingUid(undefined)
    await runSync({ approvedNewUid: uid })
  }, [pendingUid, runSync])

  const dismissPendingUid = useCallback(() => {
    if (pendingUid) dismissedUids.current.add(pendingUid)
    setPendingUid(undefined)
  }, [pendingUid])

  const createProfileFor = useCallback(
    async (uid: string) => {
      dismissedUids.current.delete(uid)
      setPendingUid(undefined)
      await runSync({ approvedNewUid: uid })
    },
    [runSync]
  )

  const importJson = useCallback(
    async (text: string) => {
      const file = validateWishFile(JSON.parse(text))
      const store = getWishStore()
      const existing = await store.load(file.uid)
      const { wishes, added } = mergeWishes(
        existing?.wishes ?? [],
        file.wishes,
        file.uid
      )
      await store.save(file.uid, wishes)
      await reloadProfiles()
      return { uid: file.uid, added }
    },
    [reloadProfiles]
  )

  const value = useMemo<WishTrackerValue>(
    () => ({
      isDesktop: desktop,
      profiles,
      keyState,
      lastOutcome,
      syncing,
      error,
      pendingUid,
      syncNow,
      checkCache,
      approvePendingUid,
      dismissPendingUid,
      createProfileFor,
      importJson,
    }),
    [
      desktop,
      profiles,
      keyState,
      lastOutcome,
      syncing,
      error,
      pendingUid,
      syncNow,
      checkCache,
      approvePendingUid,
      dismissPendingUid,
      createProfileFor,
      importJson,
    ]
  )

  return (
    <WishTrackerContext.Provider value={value}>
      {children}
    </WishTrackerContext.Provider>
  )
}
