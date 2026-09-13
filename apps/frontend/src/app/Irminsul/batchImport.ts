import type { ArtCharDatabase } from '@genshin-optimizer/gi/db'
import {
  applyImport,
  assertDestinationUnchanged,
  type ImportPreview,
  prepareImport,
} from './importSnapshot'
import type { ImportSettings } from './settings'
import type { AccountSnapshot, DataSelection } from './types'

export type BatchEntry =
  | { uid: string; preview: ImportPreview; error?: undefined }
  | { uid: string; preview?: undefined; error: string }
export type BatchResult = { uid: string; success: boolean; message: string }

export function prepareBatchImport(
  snapshots: AccountSnapshot[],
  selection: DataSelection,
  databases: ArtCharDatabase[],
  settings: ImportSettings
): BatchEntry[] {
  if (!snapshots.length)
    throw new Error('Select at least one captured account.')
  if (new Set(snapshots.map((s) => s.uid)).size !== snapshots.length)
    throw new Error('An account was selected more than once.')
  return snapshots.map((snapshot) => {
    try {
      return {
        uid: snapshot.uid,
        preview: prepareImport(snapshot, selection, databases, settings),
      }
    } catch (error) {
      return { uid: snapshot.uid, error: String(error) }
    }
  })
}

export async function applyBatchImport(
  entries: BatchEntry[],
  databases: () => ArtCharDatabase[],
  replace: (index: number, database: ArtCharDatabase) => void,
  flush: () => Promise<void>
): Promise<BatchResult[]> {
  if (!entries.length || entries.some((entry) => !entry.preview))
    throw new Error(
      'Resolve the account errors before importing this selection.'
    )
  if (new Set(entries.map((entry) => entry.uid)).size !== entries.length)
    throw new Error('An account was selected more than once.')
  const previews = entries.map((entry) => {
    if (!entry.preview) throw new Error('Account preview is missing.')
    if (entry.uid !== entry.preview.snapshot.uid)
      throw new Error(
        'The account does not match its preview. Review it again.'
      )
    assertDestinationUnchanged(entry.preview, databases())
    return entry.preview
  })
  const results: BatchResult[] = []
  for (const [index, preview] of previews.entries()) {
    try {
      await applyImport(preview, databases, replace, flush)
      results.push({
        uid: preview.snapshot.uid,
        success: true,
        message: 'Imported; previous account data backed up.',
      })
    } catch (error) {
      results.push({
        uid: preview.snapshot.uid,
        success: false,
        message: String(error),
      })
      for (const pending of previews.slice(index + 1))
        results.push({
          uid: pending.snapshot.uid,
          success: false,
          message:
            'Not imported because an earlier account failed. Review and retry this account.',
        })
      break
    }
  }
  return results
}
