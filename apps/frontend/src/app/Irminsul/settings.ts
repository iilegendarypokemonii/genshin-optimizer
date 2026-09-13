import type { WeaponKey } from '@genshin-optimizer/gi/consts'
import { allStats } from '@genshin-optimizer/gi/stats'
import {
  type AccountSnapshot,
  type DataSelection,
  dataCategories,
  defaultSelection,
} from './types'

export function readDataSelection(): DataSelection {
  try {
    const value = JSON.parse(
      localStorage.getItem('irminsul_data_selection') ?? 'null'
    )
    const selection = { ...defaultSelection }
    for (const category of dataCategories)
      if (typeof value?.[category] === 'boolean')
        selection[category] = value[category]
    return selection
  } catch {
    return { ...defaultSelection }
  }
}

export const filterFields = {
  characters: [
    ['minCharacterLevel', 'Minimum level', 1, 100],
    ['minCharacterAscension', 'Minimum ascension', 0, 6],
    ['minCharacterConstellation', 'Minimum constellation', 0, 6],
  ],
  artifacts: [
    ['minArtifactLevel', 'Minimum level', 0, 20],
    ['minArtifactRarity', 'Minimum rarity', 1, 5],
  ],
  weapons: [
    ['minWeaponLevel', 'Minimum level', 1, 90],
    ['minWeaponRefinement', 'Minimum refinement', 1, 5],
    ['minWeaponAscension', 'Minimum ascension', 0, 6],
    ['minWeaponRarity', 'Minimum rarity', 1, 5],
  ],
} as const
export type FilterKey =
  (typeof filterFields)[keyof typeof filterFields][number][0]
export type ImportSettings = Record<FilterKey, number> & {
  fakeLevelUp: boolean
}
export const defaultImportSettings: ImportSettings = {
  minCharacterLevel: 1,
  minCharacterAscension: 0,
  minCharacterConstellation: 0,
  minArtifactLevel: 0,
  minArtifactRarity: 1,
  minWeaponLevel: 1,
  minWeaponRefinement: 1,
  minWeaponAscension: 0,
  minWeaponRarity: 1,
  fakeLevelUp: false,
}

export function normalizeImportSettings(value: unknown): ImportSettings {
  const settings = { ...defaultImportSettings }
  if (!value || typeof value !== 'object') return settings
  for (const [key, , min, max] of Object.values(filterFields).flat()) {
    const raw = (value as Record<string, unknown>)[key]
    if (typeof raw === 'number' && Number.isFinite(raw))
      settings[key] = Math.min(max, Math.max(min, Math.trunc(raw)))
  }
  settings.fakeLevelUp = (value as Record<string, unknown>).fakeLevelUp === true
  return settings
}

export function readImportSettings(): ImportSettings {
  try {
    return normalizeImportSettings(
      JSON.parse(localStorage.getItem('irminsul_import_settings') ?? 'null')
    )
  } catch {
    return { ...defaultImportSettings }
  }
}

type CapturedGood = AccountSnapshot['good']
export function filterCapturedGood(good: CapturedGood, input: ImportSettings) {
  const settings = normalizeImportSettings(input)
  const result = structuredClone(good)
  result.characters = good.characters
    ?.filter(
      (c) =>
        c.level >= settings.minCharacterLevel &&
        c.ascension >= settings.minCharacterAscension &&
        c.constellation >= settings.minCharacterConstellation
    )
    .map((c) => structuredClone(c))
  result.artifacts = good.artifacts
    ?.filter(
      (a) =>
        a.level >= settings.minArtifactLevel &&
        a.rarity >= settings.minArtifactRarity
    )
    .map((a) => structuredClone(a))
  result.weapons = good.weapons
    ?.filter((w) => {
      const rarity = allStats.weapon.data[w.key as WeaponKey]?.rarity
      if (rarity === undefined)
        throw new Error(
          `Unknown weapon ${w.key}; its rarity cannot be checked.`
        )
      return (
        w.level >= settings.minWeaponLevel &&
        w.refinement >= settings.minWeaponRefinement &&
        w.ascension >= settings.minWeaponAscension &&
        rarity >= settings.minWeaponRarity
      )
    })
    .map((w) => structuredClone(w))
  if (settings.fakeLevelUp) result.artifacts?.forEach(simulateFourthStat)
  return result
}

function simulateFourthStat(
  artifact: NonNullable<CapturedGood['artifacts']>[number]
) {
  const stat = artifact.unactivatedSubstats?.[0]
  if (
    artifact.rarity !== 5 ||
    artifact.level >= 4 ||
    artifact.substats.filter((s) => s.value > 0).length !== 3 ||
    !stat
  )
    return
  artifact.level = 4
  artifact.totalRolls = 4
  artifact.substats = [...artifact.substats.filter((s) => s.value > 0), stat]
  artifact.unactivatedSubstats = artifact.unactivatedSubstats?.slice(1)
}
