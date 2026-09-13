import { SandboxStorage } from '@genshin-optimizer/common/database'
import { ArtCharDatabase } from '@genshin-optimizer/gi/db'
import { applyBatchImport, prepareBatchImport } from './batchImport'
import { defaultImportSettings } from './settings'
import { type AccountSnapshot, defaultSelection } from './types'

function accounts() {
  const databases = ([1, 2, 3, 4, 5] as const).map((index) => {
    const db = new ArtCharDatabase(index, new SandboxStorage())
    db.dbMeta.set({ uid: `10000000${index}`, name: `QA account ${index}` })
    return db
  })
  const snapshots: AccountSnapshot[] = databases.map((db, index) => ({
    uid: db.dbMeta.get().uid!,
    captureId: `capture-${index}`,
    capturedAtMs: index + 1,
    counts: { artifacts: 1, characters: 0, weapons: 0, materials: 0 },
    artifactGuids: [`${index}`],
    good: {
      format: 'GOOD',
      version: 3,
      source: 'Irminsul',
      materials: {},
      characters: [],
      weapons: [],
      artifacts: [
        {
          setKey: 'GladiatorsFinale',
          slotKey: 'flower',
          level: index,
          rarity: 5,
          mainStatKey: 'hp',
          location: '',
          lock: false,
          substats: [],
        },
      ],
    },
  }))
  return { databases, snapshots }
}

describe('batch account import', () => {
  beforeEach(() => localStorage.clear())

  it('imports five reversed snapshots into their own UID destinations with separate backups', async () => {
    const { databases, snapshots } = accounts()
    const before = databases.map((db) => JSON.stringify(db.exportGOOD()))
    const entries = prepareBatchImport(
      snapshots.reverse(),
      defaultSelection,
      databases,
      defaultImportSettings
    )
    expect(databases.map((db) => JSON.stringify(db.exportGOOD()))).toEqual(
      before
    )
    const results = await applyBatchImport(
      entries,
      () => databases,
      (i, db) => {
        databases[i] = db
      },
      async () => {}
    )
    expect(results.map((r) => r.success)).toEqual([
      true,
      true,
      true,
      true,
      true,
    ])
    for (const [index, db] of databases.entries()) {
      expect(db.arts.values).toHaveLength(1)
      expect(db.arts.values[0].level).toBe(index)
      expect(
        localStorage.getItem(`irminsul_backup_${db.dbMeta.get().uid}`)
      ).toBe(before[index])
    }
  })

  it('preflights the entire batch before any backup or database writes', async () => {
    const { databases, snapshots } = accounts()
    const entries = prepareBatchImport(
      snapshots,
      defaultSelection,
      databases,
      defaultImportSettings
    )
    databases[4].dbMeta.set({ name: 'Changed after review' })
    const replace = vi.fn(),
      flush = vi.fn()
    await expect(
      applyBatchImport(entries, () => databases, replace, flush)
    ).rejects.toThrow('changed after the preview')
    expect(replace).not.toHaveBeenCalled()
    expect(flush).not.toHaveBeenCalled()
    expect(localStorage.getItem('irminsul_backup_100000001')).toBeNull()
  })

  it('blocks empty, duplicate, missing and ambiguous destinations', async () => {
    const { databases, snapshots } = accounts()
    expect(() =>
      prepareBatchImport([], defaultSelection, databases, defaultImportSettings)
    ).toThrow('Select at least one')
    expect(() =>
      prepareBatchImport(
        [snapshots[0], snapshots[0]],
        defaultSelection,
        databases,
        defaultImportSettings
      )
    ).toThrow('more than once')
    databases[4].dbMeta.set({ uid: snapshots[0].uid })
    const entries = prepareBatchImport(
      snapshots,
      defaultSelection,
      databases,
      defaultImportSettings
    )
    expect(entries[0].error).toContain('multiple optimizer accounts')
    expect(entries[4].error).toContain('Assign UID')
    const flush = vi.fn()
    await expect(
      applyBatchImport(entries, () => databases, vi.fn(), flush)
    ).rejects.toThrow('Resolve the account errors')
    expect(flush).not.toHaveBeenCalled()
  })

  it('rejects a mismatched preview identity', async () => {
    const { databases, snapshots } = accounts()
    const entries = prepareBatchImport(
      snapshots,
      defaultSelection,
      databases,
      defaultImportSettings
    )
    entries[0].uid = '900000001'
    await expect(
      applyBatchImport(entries, () => databases, vi.fn(), vi.fn())
    ).rejects.toThrow('does not match')
  })

  it('keeps completed imports, restores a failed save and reports unattempted accounts', async () => {
    const { databases, snapshots } = accounts()
    const before = databases.map((db) => JSON.stringify(db.exportGOOD()))
    const entries = prepareBatchImport(
      snapshots,
      defaultSelection,
      databases,
      defaultImportSettings
    )
    let calls = 0
    const results = await applyBatchImport(
      entries,
      () => databases,
      (i, db) => {
        databases[i] = db
      },
      async () => {
        if (++calls === 4) throw new Error('Disk failure on second account')
      }
    )
    expect(results.map((r) => r.success)).toEqual([
      true,
      false,
      false,
      false,
      false,
    ])
    expect(results[1].message).toContain('previous account was restored')
    expect(results[2].message).toContain('Not imported')
    expect(databases[0].arts.values).toHaveLength(1)
    expect(
      databases.slice(1).map((db) => JSON.stringify(db.exportGOOD()))
    ).toEqual(before.slice(1))
    expect(localStorage.getItem('irminsul_backup_100000002')).toBe(before[1])
    expect(localStorage.getItem('irminsul_backup_100000003')).toBeNull()
  })
})
