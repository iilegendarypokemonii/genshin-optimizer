import {
  type DBStorage,
  SandboxStorage,
} from '@genshin-optimizer/common/database'
import { ArtCharDatabase } from '@genshin-optimizer/gi/db'
import { validateGOODImport } from '@genshin-optimizer/gi/good'
import type { AccountSnapshot, DataSelection } from './types'

export function exportSelection(
  snapshot: AccountSnapshot,
  selection: DataSelection
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
    ...good,
    irminsul: {
      uid: snapshot.uid,
      captureId: snapshot.captureId,
      capturedAtMs: snapshot.capturedAtMs,
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

export function prepareImport(
  snapshot: AccountSnapshot,
  selection: DataSelection,
  databases: ArtCharDatabase[]
) {
  validateSnapshot(snapshot)
  if (!selection.artifacts && !selection.characters && !selection.weapons)
    throw new Error(
      'Materials can be exported; optimizer imports support artifacts, characters, and weapons.'
    )
  const { db, index } = findDestination(snapshot.uid, databases)
  const selected = exportSelection(snapshot, selection)
  const validated = validateGOODImport(selected)
  if (!validated.success)
    throw new Error(
      'The captured data is not compatible with this optimizer version.'
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
    index,
    target: db,
    before,
    imported,
    result,
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
