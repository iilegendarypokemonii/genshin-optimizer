import { isTauri } from '@genshin-optimizer/common/util'
import { sortWishes } from './pity'
import type { Wish, WishFile } from './types'

const WISH_DIR = 'wishes'
const BACKUP_DIR = `${WISH_DIR}/backups`
const MAX_BACKUPS_PER_UID = 10
const LS_PREFIX = 'wishTracker_'

export class UidMismatchError extends Error {
  constructor(expected: string, found: string) {
    super(
      `Wish for UID ${found} cannot be merged into profile ${expected}; aborting without writing.`
    )
    this.name = 'UidMismatchError'
  }
}

export class CorruptFileError extends Error {
  constructor(uid: string, renamedTo: string) {
    super(
      `Stored wishes for UID ${uid} are unreadable; the file was moved to ${renamedTo}. Re-import a backup to restore.`
    )
    this.name = 'CorruptFileError'
  }
}

/**
 * Merge-by-id: never removes or overwrites an existing record (preserves
 * fields like source='paimonmoe'), refuses any record from another UID.
 */
export function mergeWishes(
  existing: Wish[],
  incoming: Wish[],
  uid: string
): { wishes: Wish[]; added: number } {
  const byId = new Map(existing.map((w) => [w.id, w]))
  let added = 0
  for (const w of incoming) {
    if (w.uid !== uid) throw new UidMismatchError(uid, w.uid)
    if (!byId.has(w.id)) {
      byId.set(w.id, w)
      added += 1
    }
  }
  return { wishes: sortWishes([...byId.values()]), added }
}

const REQUIRED_WISH_FIELDS = [
  'uid',
  'gacha_type',
  'time',
  'name',
  'item_type',
  'rank_type',
  'id',
] as const

/** Validate an imported JSON object; throws with a specific reason. */
export function validateWishFile(obj: unknown): WishFile {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj))
    throw new Error('Not a wish export: expected a JSON object.')
  const file = obj as Partial<WishFile>
  if (typeof file.uid !== 'string' || !/^\d{5,12}$/.test(file.uid))
    throw new Error('Not a wish export: missing or invalid "uid".')
  if (!Array.isArray(file.wishes))
    throw new Error('Not a wish export: missing "wishes" array.')
  for (const w of file.wishes) {
    for (const field of REQUIRED_WISH_FIELDS) {
      if (typeof (w as Record<string, unknown>)[field] !== 'string')
        throw new Error(`Malformed wish record: missing "${field}".`)
    }
    if ((w as Wish).uid !== file.uid)
      throw new Error(
        `Mixed UIDs inside the file (${(w as Wish).uid} vs ${file.uid}); refusing to import.`
      )
  }
  return {
    uid: file.uid,
    exported: String(file.exported ?? ''),
    wishes: file.wishes as Wish[],
  }
}

/** All-profiles backup bundle; parseImport accepts it alongside single files. */
export type WishBackupBundle = {
  format: 'go-wish-backup'
  exported: string
  profiles: WishFile[]
}

/** Accepts a single wishes_<uid>.json or a go-wish-backup bundle. */
export function parseImport(obj: unknown): WishFile[] {
  if (
    obj &&
    typeof obj === 'object' &&
    !Array.isArray(obj) &&
    Array.isArray((obj as Partial<WishBackupBundle>).profiles)
  ) {
    const profiles = (obj as WishBackupBundle).profiles
    if (!profiles.length) throw new Error('Backup bundle holds no profiles.')
    return profiles.map(validateWishFile)
  }
  return [validateWishFile(obj)]
}

export async function buildBackupBundle(): Promise<WishBackupBundle> {
  const store = getWishStore()
  const profiles: WishFile[] = []
  for (const uid of await store.listUids()) {
    const file = await store.load(uid)
    if (file) profiles.push(file)
  }
  return { format: 'go-wish-backup', exported: exportedNow(), profiles }
}

/**
 * Write a bundle of all profiles. Desktop: into app-data wishes/exports/,
 * returning the absolute path. Browser: triggers a download, returns the name.
 */
export async function exportBackup(): Promise<string> {
  const bundle = await buildBackupBundle()
  if (!bundle.profiles.length) throw new Error('No wish profiles to export.')
  const json = JSON.stringify(bundle, null, 1)
  const name = `wishes_backup_${timestamp()}.json`
  if (isTauri()) {
    const fs = await getFs()
    const baseDir = await getBaseDir()
    await fs.mkdir(`${WISH_DIR}/exports`, { baseDir, recursive: true })
    const rel = `${WISH_DIR}/exports/${name}`
    await fs.writeTextFile(rel, json, { baseDir })
    const { appLocalDataDir, join } = await import('@tauri-apps/api/path')
    return await join(await appLocalDataDir(), ...rel.split('/'))
  }
  const url = URL.createObjectURL(
    new Blob([json], { type: 'application/json' })
  )
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
  return name
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
}

function exportedNow(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export type WishStore = {
  listUids(): Promise<string[]>
  /** undefined when no profile exists. Throws CorruptFileError on bad JSON. */
  load(uid: string): Promise<WishFile | undefined>
  /** Backs up the current file, then writes atomically (tmp + rename). */
  save(uid: string, wishes: Wish[]): Promise<void>
}

async function getFs() {
  return await import('@tauri-apps/plugin-fs')
}
async function getBaseDir() {
  const { BaseDirectory } = await import('@tauri-apps/api/path')
  return BaseDirectory.AppLocalData
}

const tauriStore: WishStore = {
  async listUids() {
    const fs = await getFs()
    const baseDir = await getBaseDir()
    if (!(await fs.exists(WISH_DIR, { baseDir }))) return []
    const entries = await fs.readDir(WISH_DIR, { baseDir })
    return entries
      .map((e) => /^wishes_(\d+)\.json$/.exec(e.name)?.[1])
      .filter((uid): uid is string => !!uid)
      .sort()
  },

  async load(uid) {
    const fs = await getFs()
    const baseDir = await getBaseDir()
    const path = `${WISH_DIR}/wishes_${uid}.json`
    if (!(await fs.exists(path, { baseDir }))) return undefined
    const raw = await fs.readTextFile(path, { baseDir })
    try {
      return validateWishFile(JSON.parse(raw))
    } catch {
      const corruptPath = `${path}.corrupt.${timestamp()}`
      await fs.rename(path, corruptPath, {
        oldPathBaseDir: baseDir,
        newPathBaseDir: baseDir,
      })
      throw new CorruptFileError(uid, corruptPath)
    }
  },

  async save(uid, wishes) {
    const fs = await getFs()
    const baseDir = await getBaseDir()
    await fs.mkdir(BACKUP_DIR, { baseDir, recursive: true })
    const path = `${WISH_DIR}/wishes_${uid}.json`
    const tmpPath = `${path}.tmp`

    if (await fs.exists(path, { baseDir })) {
      await fs.copyFile(
        path,
        `${BACKUP_DIR}/wishes_${uid}.${timestamp()}.json`,
        {
          fromPathBaseDir: baseDir,
          toPathBaseDir: baseDir,
        }
      )
      await pruneBackups(uid)
    }

    const file: WishFile = {
      uid,
      exported: exportedNow(),
      wishes: sortWishes(wishes),
    }
    await fs.writeTextFile(tmpPath, JSON.stringify(file, null, 1), { baseDir })
    // Windows rename refuses to overwrite; the backup above covers the gap
    if (await fs.exists(path, { baseDir })) await fs.remove(path, { baseDir })
    await fs.rename(tmpPath, path, {
      oldPathBaseDir: baseDir,
      newPathBaseDir: baseDir,
    })
  },
}

async function pruneBackups(uid: string) {
  const fs = await getFs()
  const baseDir = await getBaseDir()
  const entries = await fs.readDir(BACKUP_DIR, { baseDir })
  const mine = entries
    .map((e) => e.name)
    .filter((n) => n.startsWith(`wishes_${uid}.`))
    .sort() // timestamped names sort chronologically
  for (const name of mine.slice(
    0,
    Math.max(0, mine.length - MAX_BACKUPS_PER_UID)
  )) {
    await fs.remove(`${BACKUP_DIR}/${name}`, { baseDir })
  }
}

/** Browser fallback: localStorage, no backups (import/view-only mode). */
const localStorageStore: WishStore = {
  async listUids() {
    const uids: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(LS_PREFIX)) uids.push(key.slice(LS_PREFIX.length))
    }
    return uids.sort()
  },
  async load(uid) {
    const raw = localStorage.getItem(`${LS_PREFIX}${uid}`)
    if (!raw) return undefined
    return validateWishFile(JSON.parse(raw))
  },
  async save(uid, wishes) {
    const file: WishFile = {
      uid,
      exported: exportedNow(),
      wishes: sortWishes(wishes),
    }
    localStorage.setItem(`${LS_PREFIX}${uid}`, JSON.stringify(file))
  },
}

export function getWishStore(): WishStore {
  return isTauri() ? tauriStore : localStorageStore
}
