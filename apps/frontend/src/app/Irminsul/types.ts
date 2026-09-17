import type { IGOOD } from '@genshin-optimizer/gi/good'

export const dataCategories = [
  'artifacts',
  'characters',
  'weapons',
  'materials',
] as const
export type DataCategory = (typeof dataCategories)[number]
export type CaptureMode = 'auto' | 'packetMonitor' | 'compatibility'
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
  // Capture keys belong to the game and may not exist in this optimizer.
  good: Omit<IGOOD, 'characters' | 'artifacts' | 'weapons'> & {
    characters?: (Omit<NonNullable<IGOOD['characters']>[number], 'key'> & {
      key: string
    })[]
    artifacts?: (Omit<
      NonNullable<IGOOD['artifacts']>[number],
      'location' | 'rarity'
    > & {
      location: string
      rarity: 1 | 2 | 3 | 4 | 5
    })[]
    weapons?: (Omit<NonNullable<IGOOD['weapons']>[number], 'location'> & {
      location: string
    })[]
    materials: Record<string, number>
  }
  artifactGuids: string[]
  unmappedMaterials?: Record<string, number>
}

export type CaptureState = {
  capturing: boolean
  activeBackend?: 'packetMonitor' | 'winsock' | null
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
