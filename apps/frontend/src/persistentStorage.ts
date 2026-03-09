import { isTauri } from '@genshin-optimizer/common/util'

const STORAGE_DIRECTORY = 'storage'
const STORAGE_FILE_PATH = `${STORAGE_DIRECTORY}/localStorage.json`
const SAVE_DEBOUNCE_MS = 200

type StorageSnapshot = Record<string, string>

let cachedPathModule: typeof import('@tauri-apps/api/path') | undefined
let cachedFsModule: typeof import('@tauri-apps/plugin-fs') | undefined

async function getTauriPath() {
  return (cachedPathModule ??= await import('@tauri-apps/api/path'))
}

async function getTauriFs() {
  return (cachedFsModule ??= await import('@tauri-apps/plugin-fs'))
}

class DesktopPersistentStorage implements Storage {
  private data = new Map<string, string>()
  private persistTimer: number | undefined
  private persistChain = Promise.resolve()

  constructor(
    initialData: StorageSnapshot,
    private readonly persistSnapshot: (snapshot: StorageSnapshot) => Promise<void>,
    private readonly mirrorStorage?: Storage
  ) {
    for (const [key, value] of Object.entries(initialData)) {
      this.data.set(key, value)
    }
    this.syncMirrorStorage(initialData)
  }

  get length() {
    return this.data.size
  }

  clear() {
    if (!this.data.size) return
    this.data.clear()
    this.mirrorStorage?.clear()
    this.schedulePersist()
  }

  getItem(key: string) {
    return this.data.get(String(key)) ?? null
  }

  key(index: number) {
    return Array.from(this.data.keys())[index] ?? null
  }

  removeItem(key: string) {
    const normalizedKey = String(key)
    if (!this.data.delete(normalizedKey)) return
    this.mirrorStorage?.removeItem(normalizedKey)
    this.schedulePersist()
  }

  setItem(key: string, value: string) {
    const normalizedKey = String(key)
    const normalizedValue = String(value)
    this.data.set(normalizedKey, normalizedValue)
    this.mirrorStorage?.setItem(normalizedKey, normalizedValue)
    this.schedulePersist()
  }

  flush() {
    if (this.persistTimer !== undefined) {
      window.clearTimeout(this.persistTimer)
      this.persistTimer = undefined
    }
    return this.queuePersist()
  }

  private schedulePersist() {
    if (this.persistTimer !== undefined) window.clearTimeout(this.persistTimer)
    this.persistTimer = window.setTimeout(() => {
      this.persistTimer = undefined
      void this.queuePersist()
    }, SAVE_DEBOUNCE_MS)
  }

  private queuePersist() {
    const snapshot = this.toJSON()
    this.persistChain = this.persistChain
      .catch(() => undefined)
      .then(() => this.persistSnapshot(snapshot))
    return this.persistChain
  }

  private toJSON(): StorageSnapshot {
    return Object.fromEntries(this.data.entries())
  }

  private syncMirrorStorage(snapshot: StorageSnapshot) {
    if (!this.mirrorStorage) return
    this.mirrorStorage.clear()
    for (const [key, value] of Object.entries(snapshot)) {
      this.mirrorStorage.setItem(key, value)
    }
  }
}

function readBrowserStorage(storage: Storage): StorageSnapshot {
  const snapshot: StorageSnapshot = {}
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index)
    if (key === null) continue
    const value = storage.getItem(key)
    if (value !== null) snapshot[key] = value
  }
  return snapshot
}

async function loadDesktopStorageSnapshot(
  fallbackStorage: Storage
): Promise<StorageSnapshot> {
  const { BaseDirectory } = await getTauriPath()
  const { exists, readTextFile } = await getTauriFs()

  const hasPersistedStorage = await exists(STORAGE_FILE_PATH, {
    baseDir: BaseDirectory.AppLocalData,
  })
  if (!hasPersistedStorage) return readBrowserStorage(fallbackStorage)

  const raw = await readTextFile(STORAGE_FILE_PATH, {
    baseDir: BaseDirectory.AppLocalData,
  })
  const parsed = JSON.parse(raw)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Desktop storage file is not a JSON object.')
  }

  return Object.fromEntries(
    Object.entries(parsed).map(([key, value]) => [key, String(value)])
  )
}

async function persistDesktopStorageSnapshot(snapshot: StorageSnapshot) {
  const { BaseDirectory } = await getTauriPath()
  const { mkdir, writeTextFile } = await getTauriFs()
  await mkdir(STORAGE_DIRECTORY, {
    baseDir: BaseDirectory.AppLocalData,
    recursive: true,
  })
  await writeTextFile(STORAGE_FILE_PATH, JSON.stringify(snapshot), {
    baseDir: BaseDirectory.AppLocalData,
  })
}

function installStorage(storage: Storage) {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    enumerable: true,
    value: storage,
  })
}

export async function initializeDesktopStorage() {
  if (!isTauri()) return

  const browserStorage = window.localStorage

  try {
    const browserSnapshot = readBrowserStorage(browserStorage)
    const snapshot =
      Object.keys(browserSnapshot).length > 0
        ? browserSnapshot
        : await loadDesktopStorageSnapshot(browserStorage)
    const storage = new DesktopPersistentStorage(
      snapshot,
      persistDesktopStorageSnapshot,
      browserStorage
    )
    installStorage(storage)

    window.addEventListener('beforeunload', () => {
      void storage.flush()
    })
    window.addEventListener('pagehide', () => {
      void storage.flush()
    })
  } catch (error) {
    console.error('Failed to initialize desktop persistent storage', error)
  }
}
