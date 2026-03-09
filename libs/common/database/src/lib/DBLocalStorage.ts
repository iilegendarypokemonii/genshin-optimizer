import type { DbIndexKey, DbVersionKey } from './DBStorage'
import { type DBStorage, type StorageType } from './DBStorage'

export class DBLocalStorage implements DBStorage {
  private storage: Storage
  dbVersionKey: DbVersionKey
  dbIndexKey: DbIndexKey

  constructor(storage: Storage, storageType: StorageType = 'go') {
    this.storage = storage
    switch (storageType) {
      case 'go':
        this.dbVersionKey = 'db_ver'
        this.dbIndexKey = 'dbIndex'
        break
      case 'sro':
        this.dbVersionKey = 'sro_db_ver'
        this.dbIndexKey = 'sro_dbIndex'
        break
      case 'zzz':
        this.dbVersionKey = 'zzz_db_ver'
        this.dbIndexKey = 'zzz_dbIndex'
    }
  }

  get keys(): string[] {
    return this.getStorageKeys()
  }
  get entries(): [key: string, value: string][] {
    return this.getStorageKeys()
      .map((key) => {
        const value = this.storage.getItem(key)
        return value === null ? undefined : ([key, value] as [string, string])
      })
      .filter((entry): entry is [string, string] => !!entry)
  }

  get(key: string) {
    const string = this.storage.getItem(key)
    if (!string) return undefined
    try {
      return JSON.parse(string)
    } catch {
      this.storage.removeItem(key)
      return undefined
    }
  }
  set(key: string, value: any): void {
    this.storage.setItem(key, JSON.stringify(value))
  }

  getString(key: string): string | undefined {
    return this.storage.getItem(key) ?? undefined
  }
  setString(key: string, value: string) {
    this.storage.setItem(key, value)
  }
  remove(key: string) {
    this.storage.removeItem(key)
  }

  copyFrom(other: DBStorage) {
    for (const [key, value] of other.entries) {
      this.setString(key, value)
    }
  }
  clear() {
    this.storage.clear()
  }
  removeForKeys(shouldRemove: (key: string) => boolean) {
    for (const key of this.getStorageKeys()) {
      if (shouldRemove(key)) this.storage.removeItem(key)
    }
  }
  getDBVersion(): number {
    return parseInt(this.getString(this.dbVersionKey) ?? '0')
  }
  setDBVersion(version: number): void {
    this.setString(this.dbVersionKey, version.toString())
  }
  getDBIndex(): 1 | 2 | 3 | 4 {
    return parseInt(this.getString(this.dbIndexKey) ?? '1') as 1 | 2 | 3 | 4
  }
  setDBIndex(ind: 1 | 2 | 3 | 4) {
    this.setString(this.dbIndexKey, ind.toString())
  }

  private getStorageKeys() {
    const keys: string[] = []
    for (let index = 0; index < this.storage.length; index++) {
      const key = this.storage.key(index)
      if (key !== null) keys.push(key)
    }
    return keys
  }
}
