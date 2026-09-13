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
import { defaultImportSettings } from './settings'
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
  it.each([
    false,
    true,
  ])('does not recreate excluded characters from equipment (character category selected: %s)', (characters) => {
    const data = snapshot()
    data.good.characters = [
      {
        key: 'Amber',
        level: 50,
        ascension: 3,
        constellation: 4,
        talent: { auto: 2, skill: 2, burst: 2 },
      },
    ]
    data.counts.characters = 1
    data.good.artifacts![0].location = 'Amber'
    data.good.weapons = [
      {
        key: 'HuntersBow',
        level: 1,
        ascension: 0,
        refinement: 1,
        location: 'Amber',
        lock: false,
      },
    ]
    data.counts.weapons = 1
    const original = structuredClone(data)
    const db = database(data.uid)
    const selection = { ...defaultSelection, characters, weapons: true }
    const settings = { ...defaultImportSettings, minCharacterLevel: 60 }
    const preview = prepareImport(data, selection, [db], settings)
    expect(preview.imported.chars.get('Amber')).toBeUndefined()
    expect(preview.imported.arts.values[0].location).toBe('')
    expect(preview.imported.weapons.values[0].location).toBe('')
    expect(preview.unequippedBySettings).toEqual({ artifacts: 1, weapons: 1 })
    expect(preview.addedCounts).toEqual({
      artifacts: 1,
      weapons: 1,
      characters: 0,
    })
    expect(
      exportSelection(data, selection, settings).artifacts![0].location
    ).toBe('Amber')
    expect(data).toEqual(original)

    db.chars.set('Amber', {
      key: 'Amber',
      level: 90,
      ascension: 6,
      constellation: 1,
      talent: { auto: 6, skill: 6, burst: 6 },
    })
    const existing = prepareImport(data, selection, [db], settings)
    expect(existing.unequippedBySettings).toEqual({ artifacts: 0, weapons: 0 })
    expect(existing.imported.arts.values[0].location).toBe('Amber')
    expect(existing.imported.chars.get('Amber')).toMatchObject({
      level: 90,
      constellation: 1,
      talent: { auto: 6, skill: 6, burst: 6 },
    })
  })

  it('keeps Traveler equipment assigned to an included elemental character', () => {
    const data = snapshot()
    data.good.characters = [
      {
        key: 'TravelerAnemo',
        level: 90,
        ascension: 6,
        constellation: 6,
        talent: { auto: 9, skill: 9, burst: 9 },
      },
    ]
    data.counts.characters = 1
    data.good.artifacts![0].location = 'Traveler'
    const db = database(data.uid)
    const preview = prepareImport(
      data,
      { ...defaultSelection, characters: true },
      [db]
    )
    expect(preview.unequippedBySettings.artifacts).toBe(0)
    expect(preview.imported.arts.values[0].location).toBe('Traveler')
    db.chars.set('TravelerGeo', {
      key: 'TravelerGeo',
      level: 90,
      ascension: 6,
      constellation: 6,
      talent: { auto: 9, skill: 9, burst: 9 },
    })
    const existing = prepareImport(data, defaultSelection, [db])
    expect(existing.unequippedBySettings.artifacts).toBe(0)
    expect(existing.imported.arts.values[0].location).toBe('Traveler')
  })

  it('reports actual added entries, including default equipment on a new selected character', () => {
    const data = snapshot()
    data.good.characters = [
      {
        key: 'Amber',
        level: 100,
        ascension: 6,
        constellation: 4,
        talent: { auto: 9, skill: 9, burst: 9 },
      },
    ]
    data.counts.characters = 1
    const preview = prepareImport(
      data,
      { ...defaultSelection, characters: true, weapons: true },
      [database(data.uid)]
    )
    expect(preview.imported.chars.get('Amber')?.level).toBe(100)
    expect(preview.result.weapons.import).toBe(0)
    expect(preview.addedCounts.weapons).toBe(
      preview.imported.weapons.values.length
    )
  })

  it('excludes 1- and 2-star artifacts from import without changing their exported rarity', () => {
    const data = snapshot()
    const artifact = data.good.artifacts![0]
    data.good.artifacts = [
      artifact,
      { ...artifact, setKey: 'Adventurer', rarity: 1 },
      { ...artifact, setKey: 'Adventurer', rarity: 2 },
    ]
    data.counts.artifacts = 3
    data.artifactGuids = ['1', '2', '3']
    const db = database(data.uid)
    const before = JSON.stringify(db.exportGOOD())
    const preview = prepareImport(data, defaultSelection, [db])
    expect(preview.skippedArtifacts).toBe(2)
    expect(preview.imported.arts.values).toHaveLength(1)
    expect(preview.result.artifacts.invalid).toEqual([])
    expect(
      exportSelection(data, defaultSelection).artifacts?.map((a) => a.rarity)
    ).toEqual([5, 1, 2])
    expect(JSON.stringify(db.exportGOOD())).toBe(before)
  })

  it.each([
    'Manekin',
    'Manekina',
  ])('previews supported data with %s explicitly excluded and preserves the export', (key) => {
    const data = snapshot()
    const character = {
      key,
      ascension: 0 as const,
      constellation: 0,
      level: 20,
      talent: { auto: 1, skill: 1, burst: 1 },
    }
    data.good.characters = [character, { ...character, key: 'Amber' }]
    data.good.artifacts![0].location = key
    data.good.weapons = [
      {
        key: 'HuntersBow',
        level: 1,
        ascension: 0,
        refinement: 1,
        lock: false,
        location: key,
      },
    ]
    data.counts.characters = 2
    data.counts.weapons = 1
    const db = database(data.uid)
    const before = JSON.stringify(db.exportGOOD())
    const selection = { ...defaultSelection, characters: true, weapons: true }
    const preview = prepareImport(data, selection, [db])
    expect(preview.skippedCharacters).toEqual([key])
    expect(preview.result.characters.new).toHaveLength(1)
    expect(preview.imported.chars.get('Amber')?.level).toBe(20)
    expect(preview.imported.arts.values).toHaveLength(1)
    expect(preview.unequippedItems).toEqual({ artifacts: 1, weapons: 1 })
    expect(preview.imported.arts.values[0].location).toBe('')
    expect(
      preview.imported.weapons.values.some(
        (w) => w.key === 'HuntersBow' && w.location === ''
      )
    ).toBe(true)
    expect(exportSelection(data, selection).artifacts![0].location).toBe(key)
    expect(exportSelection(data, selection).weapons![0].location).toBe(key)
    expect(exportSelection(data, selection).characters).toEqual([
      character,
      { ...character, key: 'Amber' },
    ])
    expect(JSON.stringify(db.exportGOOD())).toBe(before)
    expect(
      prepareImport(data, defaultSelection, [db]).skippedCharacters
    ).toEqual([])
    expect(prepareImport(data, defaultSelection, [db]).unequippedItems).toEqual(
      { artifacts: 1, weapons: 0 }
    )
  })

  it('identifies unsupported characters without silently discarding them', () => {
    const data = snapshot()
    data.good.characters = [
      {
        key: 'UnknownFutureCharacter',
        ascension: 0,
        constellation: 0,
        level: 20,
        talent: { auto: 1, skill: 1, burst: 1 },
      },
    ]
    data.counts.characters = 1
    const db = database(data.uid)
    const before = JSON.stringify(db.exportGOOD())
    expect(() =>
      prepareImport(data, { ...defaultSelection, characters: true }, [db])
    ).toThrow('characters.0.key (UnknownFutureCharacter)')
    expect(JSON.stringify(db.exportGOOD())).toBe(before)
  })

  it('identifies invalid fields without mutating the account', () => {
    const data = snapshot()
    data.good.artifacts![0].totalRolls = 99
    const db = database(data.uid)
    const before = JSON.stringify(db.exportGOOD())
    expect(() => prepareImport(data, defaultSelection, [db])).toThrow(
      'artifacts.0.totalRolls'
    )
    expect(JSON.stringify(db.exportGOOD())).toBe(before)
  })

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
