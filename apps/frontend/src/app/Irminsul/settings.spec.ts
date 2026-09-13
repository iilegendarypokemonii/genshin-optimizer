import { exportSelection } from './importSnapshot'
import {
  defaultImportSettings,
  filterCapturedGood,
  normalizeImportSettings,
  readDataSelection,
  readImportSettings,
} from './settings'
import { type AccountSnapshot, defaultSelection } from './types'

function good(): AccountSnapshot['good'] {
  return {
    format: 'GOOD',
    version: 3,
    source: 'Irminsul',
    materials: { Mora: 100 },
    characters: [
      {
        key: 'Amber',
        level: 40,
        ascension: 2,
        constellation: 3,
        talent: { auto: 1, skill: 1, burst: 1 },
      },
    ],
    weapons: [
      {
        key: 'FavoniusWarbow',
        level: 40,
        ascension: 2,
        refinement: 3,
        location: '',
        lock: false,
      },
    ],
    artifacts: [
      {
        setKey: 'GladiatorsFinale',
        slotKey: 'flower',
        level: 0,
        rarity: 5,
        mainStatKey: 'hp',
        location: '',
        lock: false,
        substats: [
          { key: 'critRate_', value: 3.9 },
          { key: 'critDMG_', value: 7.8 },
          { key: 'atk_', value: 5.8 },
        ],
        unactivatedSubstats: [{ key: 'enerRech_', value: 6.5 }],
        totalRolls: 3,
      },
    ],
  }
}

describe('capture settings', () => {
  it.each([
    ['characters', 'minCharacterLevel', 40],
    ['characters', 'minCharacterAscension', 2],
    ['characters', 'minCharacterConstellation', 3],
    ['artifacts', 'minArtifactLevel', 0],
    ['artifacts', 'minArtifactRarity', 4],
    ['weapons', 'minWeaponLevel', 40],
    ['weapons', 'minWeaponAscension', 2],
    ['weapons', 'minWeaponRefinement', 3],
    ['weapons', 'minWeaponRarity', 4],
  ] as const)('filters %s at the %s boundary', (category, key, boundary) => {
    const data = good()
    if (key === 'minArtifactRarity') data.artifacts![0].rarity = 4
    expect(
      filterCapturedGood(data, { ...defaultImportSettings, [key]: boundary })[
        category
      ]
    ).toHaveLength(1)
    expect(
      filterCapturedGood(data, {
        ...defaultImportSettings,
        [key]: boundary + 1,
      })[category]
    ).toHaveLength(0)
  })

  it('simulates only eligible artifacts on an export copy, after filtering', () => {
    const data = good()
    const original = structuredClone(data)
    expect(filterCapturedGood(data, defaultImportSettings)).toEqual(data)
    const simulated = filterCapturedGood(data, {
      ...defaultImportSettings,
      fakeLevelUp: true,
    }).artifacts![0]
    expect(simulated.level).toBe(4)
    expect(simulated.totalRolls).toBe(4)
    expect(simulated.substats).toHaveLength(4)
    expect(simulated.unactivatedSubstats).toEqual([])
    expect(
      filterCapturedGood(data, {
        ...defaultImportSettings,
        fakeLevelUp: true,
        minArtifactLevel: 4,
      }).artifacts
    ).toEqual([])
    expect(data).toEqual(original)
    for (const patch of [
      { rarity: 4 as const },
      { level: 4 },
      { unactivatedSubstats: [] },
      { substats: simulated.substats },
    ]) {
      const ineligible = good()
      Object.assign(ineligible.artifacts![0], patch)
      expect(
        filterCapturedGood(ineligible, {
          ...defaultImportSettings,
          fakeLevelUp: true,
        })
      ).toEqual(ineligible)
    }
  })

  it('does not inspect deselected unknown weapons and omits unselected categories from JSON', () => {
    const data = good()
    // Simulate a future captured key which is absent from the optimizer database.
    Object.assign(data.weapons![0], { key: 'FutureWeapon' })
    const snapshot: AccountSnapshot = {
      uid: '100000001',
      captureId: 'one',
      capturedAtMs: 1,
      counts: { artifacts: 1, characters: 1, weapons: 1, materials: 1 },
      artifactGuids: ['1'],
      good: data,
    }
    const exported = JSON.parse(
      JSON.stringify(exportSelection(snapshot, defaultSelection))
    )
    expect(Object.keys(exported)).not.toContain('weapons')
    expect(Object.keys(exported)).not.toContain('characters')
    expect(Object.keys(exported)).not.toContain('materials')
    expect(() =>
      exportSelection(snapshot, { ...defaultSelection, weapons: true })
    ).toThrow('Unknown weapon FutureWeapon')
  })

  it('restores bounded settings and category preferences, tolerating corrupt storage', () => {
    expect(
      normalizeImportSettings({
        minArtifactLevel: 999,
        minWeaponRarity: -3,
        minCharacterLevel: 40.9,
        minWeaponLevel: Number.NaN,
        fakeLevelUp: 'true',
      })
    ).toMatchObject({
      minArtifactLevel: 20,
      minWeaponRarity: 1,
      minCharacterLevel: 40,
      minWeaponLevel: 1,
      fakeLevelUp: false,
    })
    localStorage.setItem('irminsul_import_settings', '{broken')
    expect(readImportSettings()).toEqual(defaultImportSettings)
    localStorage.setItem(
      'irminsul_data_selection',
      JSON.stringify({ artifacts: false, weapons: true, characters: 'true' })
    )
    expect(readDataSelection()).toEqual({
      ...defaultSelection,
      artifacts: false,
      weapons: true,
    })
    localStorage.setItem('irminsul_data_selection', '{broken')
    expect(readDataSelection()).toEqual(defaultSelection)
  })
})
