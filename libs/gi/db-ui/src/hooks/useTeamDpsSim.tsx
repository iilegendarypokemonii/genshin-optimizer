import { useDataManagerBase } from '@genshin-optimizer/common/database-ui'
import { useDatabase } from './useDatabase'
export function useTeamDpsSim(simId: string) {
  const database = useDatabase()
  return useDataManagerBase(database.teamDpsSims, simId)
}
