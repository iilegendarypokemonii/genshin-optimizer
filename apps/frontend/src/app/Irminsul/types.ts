import type { IGOOD } from '@genshin-optimizer/gi/good'

export const dataCategories = [
  'artifacts',
  'characters',
  'weapons',
  'materials',
] as const
export type DataCategory = (typeof dataCategories)[number]
export type DataSelection = Record<DataCategory, boolean>
export const defaultSelection: DataSelection = {
  artifacts: true,
  characters: false,
  weapons: false,
  materials: false,
}

export type SnapshotSummary = {
  uid: string
  captureId: string
  capturedAtMs: number
  counts: Record<DataCategory, number>
  warnings?: string[]
}

export type AccountSnapshot = SnapshotSummary & {
  good: IGOOD & { materials: Record<string, number> }
  artifactGuids: string[]
  unmappedMaterials?: Record<string, number>
}

export type CaptureState = {
  capturing: boolean
  phase: string
  message: string
  activeUid: string | null
  snapshots: SnapshotSummary[]
}

export const idleState: CaptureState = {
  capturing: false,
  phase: 'idle',
  activeUid: null,
  snapshots: [],
  message: 'Start capture before entering the game door.',
}
