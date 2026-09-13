import { SandboxStorage } from '@genshin-optimizer/common/database'
import { ArtCharDatabase } from '@genshin-optimizer/gi/db'
import {
  applyImport,
  assertDestinationUnchanged,
  exportSelection,
  findDestination,
  prepareImport,
  validateSnapshot,
} from './importSnapshot'
import { type AccountSnapshot, defaultSelection } from './types'

function database(uid: string, index: 1 | 2 = 1) {
  const db = new ArtCharDatabase(index, new SandboxStorage())
  db.dbMeta.set({ uid, name: `Account ${index}` })
  return db
}

function snapshot(): AccountSnapshot {
  return {
    uid: '100000001',
    captureId: 'capture-one',
    capturedAtMs: 100,
    counts: { artifacts: 1, characters: 0, weapons: 0, materials: 1 },
    artifactGuids: ['12345678901234567890'],
    good: {
      format: 'GOOD',
      version: 3,
      source: 'Irminsul',
      characters: [],
      weapons: [],
      materials: { Mora: 100 },
      artifacts: [
        {
          setKey: 'GladiatorsFinale',
          slotKey: 'flower',
          level: 0,
          rarity: 5,
          mainStatKey: 'hp',
          location: '',
          lock: false,
          substats: [],
        },
      ],
    },
  }
}

describe('captured account import', () => {
  it('restores storage if the swap fails after exchanging storage objects', async () => {
    const db = database('100000001')
    const preview = prepareImport(snapshot(), defaultSelection, [db])
    const originalStorage = db.storage
    originalStorage.setString('future-setting', 'opaque value')
    const before = JSON.stringify(db.exportGOOD())
    vi.spyOn(preview.imported, 'saveStorage').mockImplementationOnce(() => {
      originalStorage.remove('future-setting')
      throw new Error('Write failed during swap')
    })
    await expect(
      applyImport(
        preview,
        () => [db],
        vi.fn(),
        vi.fn().mockResolvedValue(undefined)
      )
    ).rejects.toThrow('previous account was restored')
    expect(db.storage).toBe(originalStorage)
    expect(originalStorage.getString('future-setting')).toBe('opaque value')
    expect(JSON.stringify(db.exportGOOD())).toBe(before)
    expect(
      new ArtCharDatabase(db.dbIndex, db.storage).arts.values
    ).toHaveLength(0)
  })
  it('restores prior storage when saving an import fails', async () => {
    const db = database('100000001')
    const preview = prepareImport(snapshot(), defaultSelection, [db])
    const before = JSON.stringify(db.exportGOOD())
    const replace = vi.fn()
    const originalStorage = db.storage
    const flush = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(async () => {
        originalStorage.setString('unrelated-concurrent-write', 'keep this')
        throw new Error('Disk full')
      })
      .mockResolvedValueOnce(undefined)
    await expect(
      applyImport(preview, () => [db], replace, flush)
    ).rejects.toThrow('previous account was restored')
    expect(replace).not.toHaveBeenCalled()
    expect(originalStorage.getString('unrelated-concurrent-write')).toBe(
      'keep this'
    )
    expect(JSON.stringify(db.exportGOOD())).toBe(before)
    expect(
      new ArtCharDatabase(db.dbIndex, db.storage).arts.values
    ).toHaveLength(0)
    expect(localStorage.getItem('irminsul_backup_100000001')).toBe(before)
    expect(flush).toHaveBeenCalledTimes(3)
  })
  it('requires an exact and unique captured UID destination', () => {
    const db = database('100000002')
    expect(() => findDestination('100000001', [db])).toThrow('Assign UID')
    db.dbMeta.set({ uid: '100000001' })
    expect(() =>
      findDestination('100000001', [db, database('100000001', 2)])
    ).toThrow('multiple')
  })

  it('creates a preview without changing the destination and preserves absent items', () => {
    const db = database('100000001')
    db.arts.new({
      setKey: 'GladiatorsFinale',
      slotKey: 'plume',
      level: 0,
      rarity: 5,
      mainStatKey: 'atk',
      location: '',
      lock: true,
      substats: [],
    })
    const before = JSON.stringify(db.exportGOOD())
    const preview = prepareImport(snapshot(), defaultSelection, [db])
    expect(JSON.stringify(db.exportGOOD())).toBe(before)
    expect(preview.imported.arts.values).toHaveLength(2)
    expect(preview.result.artifacts.remove).toHaveLength(0)
    expect(preview.result.artifacts.new).toHaveLength(1)
  })

  it('rejects changed destination state after preview', () => {
    const db = database('100000001')
    const preview = prepareImport(snapshot(), defaultSelection, [db])
    db.dbMeta.set({ name: 'Changed' })
    expect(() => assertDestinationUnchanged(preview, [db])).toThrow(
      'changed after'
    )
  })

  it('omits unselected categories and includes account provenance', () => {
    const exported = exportSelection(snapshot(), {
      ...defaultSelection,
      materials: true,
    })
    expect(exported.artifacts).toHaveLength(1)
    expect(exported.materials).toEqual({ Mora: 100 })
    expect(exported.characters).toBeUndefined()
    expect(exported.weapons).toBeUndefined()
    expect(exported.irminsul.uid).toBe('100000001')
  })

  it('rejects partial snapshots, duplicate GUIDs, and empty selections', () => {
    const data = snapshot()
    data.counts.artifacts = 2
    expect(() => validateSnapshot(data)).toThrow('incomplete')
    data.good.artifacts?.push(data.good.artifacts[0])
    data.artifactGuids.push(data.artifactGuids[0])
    expect(() => validateSnapshot(data)).toThrow('duplicate')
    expect(() =>
      exportSelection(snapshot(), {
        artifacts: false,
        characters: false,
        weapons: false,
        materials: false,
      })
    ).toThrow('Select')
  })
})
