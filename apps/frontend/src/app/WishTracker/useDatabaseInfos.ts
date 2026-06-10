import { useDataEntryBase } from '@genshin-optimizer/common/database-ui'
import { DatabaseContext } from '@genshin-optimizer/gi/db-ui'
import { useContext, useMemo } from 'react'

export type DatabaseInfo = { name: string; uid: string }

/** Name + UID of all 6 GO database slots, for labeling wish profiles. */
export function useDatabaseInfos(): DatabaseInfo[] {
  const { databases } = useContext(DatabaseContext)
  const meta0 = useDataEntryBase(databases[0]?.dbMeta)
  const meta1 = useDataEntryBase(databases[1]?.dbMeta)
  const meta2 = useDataEntryBase(databases[2]?.dbMeta)
  const meta3 = useDataEntryBase(databases[3]?.dbMeta)
  const meta4 = useDataEntryBase(databases[4]?.dbMeta)
  const meta5 = useDataEntryBase(databases[5]?.dbMeta)
  return useMemo(
    () =>
      [meta0, meta1, meta2, meta3, meta4, meta5]
        .filter(Boolean)
        .map((m) => ({ name: m.name, uid: m.uid ?? '' })),
    [meta0, meta1, meta2, meta3, meta4, meta5]
  )
}

export function slotLabel(
  infos: DatabaseInfo[],
  uid: string
): string | undefined {
  return infos.find((info) => info.uid === uid)?.name
}

/** Sort by slot name (named profiles first, then by UID). */
export function bySlotLabel(infos: DatabaseInfo[]) {
  return (a: { uid: string }, b: { uid: string }): number => {
    const la = slotLabel(infos, a.uid)
    const lb = slotLabel(infos, b.uid)
    if (!!la !== !!lb) return la ? -1 : 1
    return (la ?? a.uid).localeCompare(lb ?? b.uid, undefined, {
      numeric: true,
    })
  }
}

export function timeAgo(ms: number | undefined): string {
  if (!ms) return 'never'
  const diff = Date.now() - ms
  if (diff < 60_000) return 'just now'
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
