import {
  type DBStorage,
  SandboxStorage,
} from '@genshin-optimizer/common/database'
import {
  type CharacterKey,
  charKeyToLocCharKey,
} from '@genshin-optimizer/gi/consts'
import { ArtCharDatabase } from '@genshin-optimizer/gi/db'
import { validateGOODImport } from '@genshin-optimizer/gi/good'
import {
  defaultImportSettings,
  filterCapturedGood,
  type ImportSettings,
} from './settings'
import type { AccountSnapshot, DataSelection } from './types'

// Miliastra Wonderland avatars are captured game data, but not optimizer
// characters. Keep their records in exports and explain omissions in the preview.
const wonderlandAvatars = new Set(['Manekin', 'Manekina'])

function prepareOptimizerData(selected: ReturnType<typeof exportSelection>) {
  const skippedArtifacts = (selected.artifacts ?? []).filter(
    ({ rarity }) => rarity === 1 || rarity === 2
  ).length
  if (selected.artifacts)
    selected.artifacts = selected.artifacts.filter(
      ({ rarity }) => rarity !== 1 && rarity !== 2
    )
  const skippedCharacters = (selected.characters ?? [])
    .filter(({ key }) => wonderlandAvatars.has(key))
    .map(({ key }) => key)
  if (selected.characters)
    selected.characters = selected.characters.filter(
      ({ key }) => !wonderlandAvatars.has(key)
    )
  const unequippedItems = { artifacts: 0, weapons: 0 }
  for (const category of ['artifacts', 'weapons'] as const) {
    const equipment = (selected[category] ?? []).filter(({ location }) =>
      wonderlandAvatars.has(location)
    )
    unequippedItems[category] = equipment.length
    for (const item of equipment) item.location = ''
  }
  return { skippedArtifacts, skippedCharacters, unequippedItems }
}

function invalidFields(
  errors: { path: string }[],
  selected: ReturnType<typeof exportSelection>
) {
  return errors
    .slice(0, 3)
    .map(({ path }) => {
      const [category, index] = path.split('.')
      const key =
        category === 'characters' || category === 'weapons'
          ? selected[category]?.[Number(index)]?.key
          : undefined
      return key ? `${path} (${key.slice(0, 80)})` : path
    })
    .join(', ')
}

export function exportSelection(
  snapshot: AccountSnapshot,
  selection: DataSelection,
  settings: ImportSettings = defaultImportSettings
) {
  if (!Object.values(selection).some(Boolean))
    throw new Error('Select at least one data category.')
  const good = structuredClone(snapshot.good)
  for (const category of [
    'artifacts',
    'characters',
    'weapons',
    'materials',
  ] as const) {
    if (!selection[category]) delete good[category]
  }
  return {
    ...filterCapturedGood(good, settings),
    irminsul: {
      uid: snapshot.uid,
      captureId: snapshot.captureId,
      capturedAtMs: snapshot.capturedAtMs,
      settings: { ...settings },
      ...(selection.materials && snapshot.unmappedMaterials
        ? { unmappedMaterials: snapshot.unmappedMaterials }
        : {}),
    },
  }
}

export function findDestination(uid: string, databases: ArtCharDatabase[]) {
  const matches = databases
    .map((db, index) => ({ db, index }))
    .filter(({ db }) => db.dbMeta.get().uid === uid)
  if (!matches.length)
    throw new Error(
      `Assign UID ${uid} to an optimizer account in Settings before importing. You can export this snapshot now.`
    )
  if (matches.length !== 1)
    throw new Error(
      `UID ${uid} is assigned to multiple optimizer accounts. Give it a unique destination in Settings.`
    )
  return matches[0]
}

export function validateSnapshot(snapshot: AccountSnapshot) {
  if (!/^\d{9,10}$/.test(snapshot.uid) || !snapshot.captureId)
    throw new Error('The snapshot has no supported account identity.')
  const artifacts = snapshot.good.artifacts
  if (
    !Array.isArray(artifacts) ||
    artifacts.length !== snapshot.counts.artifacts ||
    snapshot.artifactGuids.length !== artifacts.length ||
    new Set(snapshot.artifactGuids).size !== artifacts.length
  )
    throw new Error(
      'The artifact snapshot is incomplete or contains duplicate identifiers.'
    )
  if (
    snapshot.good.characters?.length !== snapshot.counts.characters ||
    snapshot.good.weapons?.length !== snapshot.counts.weapons
  )
    throw new Error('The character or weapon snapshot is incomplete.')
}

function countFilteredRecords(
  snapshot: AccountSnapshot,
  selection: DataSelection,
  selected: ReturnType<typeof exportSelection>
) {
  return {
    artifacts: selection.artifacts
      ? snapshot.counts.artifacts - (selected.artifacts?.length ?? 0)
      : 0,
    characters: selection.characters
      ? snapshot.counts.characters - (selected.characters?.length ?? 0)
      : 0,
    weapons: selection.weapons
      ? snapshot.counts.weapons - (selected.weapons?.length ?? 0)
      : 0,
  }
}

function removeUnavailableLocations(
  selected: ReturnType<typeof exportSelection>,
  database: ArtCharDatabase
) {
  const available = new Set<string>([
    ...database.chars.keys.map(charKeyToLocCharKey),
    ...(selected.characters?.map(({ key }) =>
      charKeyToLocCharKey(key as CharacterKey)
    ) ?? []),
  ])
  const unequipped = { artifacts: 0, weapons: 0 }
  for (const category of ['artifacts', 'weapons'] as const) {
    for (const item of selected[category] ?? []) {
      if (!item.location || available.has(item.location)) continue
      item.location = ''
      unequipped[category]++
    }
  }
  return unequipped
}

export function prepareImport(
  snapshot: AccountSnapshot,
  selection: DataSelection,
  databases: ArtCharDatabase[],
  settings: ImportSettings = defaultImportSettings
) {
  validateSnapshot(snapshot)
  if (!selection.artifacts && !selection.characters && !selection.weapons)
    throw new Error(
      'Materials can be exported; optimizer imports support artifacts, characters, and weapons.'
    )
  const { db, index } = findDestination(snapshot.uid, databases)
  const selected = exportSelection(snapshot, selection, settings)
  const filteredCounts = countFilteredRecords(snapshot, selection, selected)
  const { skippedArtifacts, skippedCharacters, unequippedItems } =
    prepareOptimizerData(selected)
  // The legacy importer creates default characters from equipment locations.
  // Do not let that reintroduce characters excluded by selection or filters.
  const unequippedBySettings = removeUnavailableLocations(selected, db)
  const validated = validateGOODImport(selected)
  if (!validated.success)
    throw new Error(
      `Cannot import captured data. Invalid or unsupported fields: ${invalidFields(validated.errors, selected)}. No account data was changed. Deselect the affected category to import the others.`
    )
  const before = JSON.stringify(db.exportGOOD())
  const storage = new SandboxStorage()
  storage.copyFrom(db.storage)
  const imported = new ArtCharDatabase(db.dbIndex, storage)
  // The legacy importer accepts scanner GOOD at runtime, but its parameter is
  // typed as a full optimizer backup. Preserve the actual scanner source.
  const result = imported.importGOOD(
    validated.data as Parameters<ArtCharDatabase['importGOOD']>[0],
    true,
    true,
    false
  )
  if (
    result.artifacts.invalid.length ||
    result.weapons.invalid.length ||
    result.characters.invalid.length
  )
    throw new Error(
      'Some selected records could not be imported. No account data was changed.'
    )
  return {
    snapshot,
    selection: { ...selection },
    settings: { ...settings },
    filteredCounts,
    index,
    target: db,
    before,
    imported,
    result,
    skippedArtifacts,
    skippedCharacters,
    unequippedItems,
    unequippedBySettings,
    addedCounts: {
      artifacts: imported.arts.values.filter(({ id }) => !db.arts.get(id))
        .length,
      characters: imported.chars.values.filter(({ key }) => !db.chars.get(key))
        .length,
      weapons: imported.weapons.values.filter(({ id }) => !db.weapons.get(id))
        .length,
    },
  }
}

export type ImportPreview = ReturnType<typeof prepareImport>

export async function applyImport(
  preview: ImportPreview,
  databases: () => ArtCharDatabase[],
  replace: (index: number, database: ArtCharDatabase) => void,
  flush: () => Promise<void>
) {
  assertDestinationUnchanged(preview, databases())
  localStorage.setItem(
    `irminsul_backup_${preview.snapshot.uid}`,
    preview.before
  )
  await flush()
  const target = assertDestinationUnchanged(preview, databases())
  const originalStorage = target.storage
  const previewStorage = preview.imported.storage
  const beforeEntries = new Map(originalStorage.entries)
  const extraKey = `extraDatabase_${target.dbIndex}`
  const beforeExtra = localStorage.getItem(extraKey)
  let writtenEntries: Map<string, string> | undefined
  let writtenExtra = beforeExtra
  try {
    preview.imported.swapStorage(target)
    preview.imported.toExtraLocalDB()
    writtenEntries = new Map(originalStorage.entries)
    writtenExtra = localStorage.getItem(extraKey)
    await flush()
  } catch (cause) {
    // A synchronous failure has no intervening writes; capture its partial delta.
    if (!writtenEntries) {
      writtenEntries = new Map(originalStorage.entries)
      writtenExtra = localStorage.getItem(extraKey)
    }
    target.storage = originalStorage
    preview.imported.storage = previewStorage
    try {
      const currentExtra = localStorage.getItem(extraKey)
      if (currentExtra !== writtenExtra && currentExtra !== beforeExtra)
        throw new Error('The account changed while saving.')
      restoreEntries(originalStorage, beforeEntries, writtenEntries)
      if (beforeExtra === null) localStorage.removeItem(extraKey)
      else localStorage.setItem(extraKey, beforeExtra)
      await flush()
    } catch {
      throw new Error(
        'Saving failed and recovery could not finish. Download the previous account backup before closing the app.'
      )
    }
    throw new Error(
      `Import could not be saved; the previous account was restored. ${String(cause)}`
    )
  }
  replace(preview.index, preview.imported)
}

function restoreEntries(
  storage: DBStorage,
  before: Map<string, string>,
  written: Map<string, string>
) {
  const changed = [...new Set([...before.keys(), ...written.keys()])].filter(
    (key) => before.get(key) !== written.get(key)
  )
  for (const key of changed) {
    const current = storage.getString(key)
    if (current !== written.get(key) && current !== before.get(key))
      throw new Error('Account data changed while saving.')
  }
  for (const key of changed) {
    const value = before.get(key)
    if (value === undefined) storage.remove(key)
    else storage.setString(key, value)
  }
}

export function assertDestinationUnchanged(
  preview: ImportPreview,
  databases: ArtCharDatabase[]
) {
  const { db, index } = findDestination(preview.snapshot.uid, databases)
  if (
    db !== preview.target ||
    index !== preview.index ||
    JSON.stringify(db.exportGOOD()) !== preview.before
  )
    throw new Error(
      'The destination account changed after the preview. Preview this import again.'
    )
  return db
}
