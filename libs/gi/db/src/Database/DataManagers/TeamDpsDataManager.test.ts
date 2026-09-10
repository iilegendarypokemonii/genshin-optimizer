import { DBLocalStorage } from '@genshin-optimizer/common/database'
import type { CharacterKey } from '@genshin-optimizer/gi/consts'
import { ArtCharDatabase } from '../ArtCharDatabase'
import type { TeamDpsRun } from './TeamDpsDataManager'
import {
  bestTeamDpsRun,
  latestTeamDpsRun,
  TeamDpsDataManager,
  teamDpsCharacter,
} from './TeamDpsDataManager'

const team: CharacterKey[] = ['RaidenShogun', 'Bennett', 'Xingqiu', 'Xiangling']

function makeRun(id: string, overrides: Partial<TeamDpsRun> = {}): TeamDpsRun {
  return {
    id,
    date: 1000,
    dps: 100_000,
    totalDamage: 1_000_000,
    contributions: [
      { character: 'RaidenShogun', damage: 700_000 },
      { character: 'Xiangling', damage: 200_000 },
      { character: 'Xingqiu', damage: 90_000 },
      { character: 'Bennett', damage: 10_000 },
    ],
    hasScreenshot: false,
    ...overrides,
  }
}

describe('TeamDpsDataManager', () => {
  const dbStorage = new DBLocalStorage(localStorage)
  const dbIndex = 1
  let database = new ArtCharDatabase(dbIndex, dbStorage)

  beforeEach(() => {
    dbStorage.clear()
    database = new ArtCharDatabase(dbIndex, dbStorage)
  })

  test('addRun creates a sim with sorted characters and computed teamKey', () => {
    const simId = database.teamDpsSims.addRun(team, makeRun('run1'))
    expect(simId).toBeTruthy()
    const sim = database.teamDpsSims.get(simId)!
    expect(sim.characters).toEqual([
      'Bennett',
      'RaidenShogun',
      'Xiangling',
      'Xingqiu',
    ])
    expect(sim.teamKey).toEqual('Bennett_RaidenShogun_Xiangling_Xingqiu')
    expect(sim.runs.length).toEqual(1)
  })

  test('addRun merges into the same sim regardless of character order', () => {
    const simId = database.teamDpsSims.addRun(team, makeRun('run1'))
    const shuffled: CharacterKey[] = [
      'Xiangling',
      'Bennett',
      'RaidenShogun',
      'Xingqiu',
    ]
    const simId2 = database.teamDpsSims.addRun(shuffled, makeRun('run2'))
    expect(simId2).toEqual(simId)
    expect(database.teamDpsSims.get(simId)!.runs.length).toEqual(2)
    expect(database.teamDpsSims.keys.length).toEqual(1)
  })

  test('a different team creates a separate sim', () => {
    const simId = database.teamDpsSims.addRun(team, makeRun('run1'))
    const variant: CharacterKey[] = [
      'RaidenShogun',
      'Bennett',
      'Xingqiu',
      'KaedeharaKazuha',
    ]
    const simId2 = database.teamDpsSims.addRun(
      variant,
      makeRun('run2', { contributions: [] })
    )
    expect(simId2).not.toEqual(simId)
    expect(database.teamDpsSims.keys.length).toEqual(2)
  })

  test('rejects teams without 4 distinct characters', () => {
    const dup: CharacterKey[] = [
      'RaidenShogun',
      'RaidenShogun',
      'Bennett',
      'Xingqiu',
    ]
    expect(database.teamDpsSims.addRun(dup, makeRun('run1'))).toEqual('')
    expect(database.teamDpsSims.keys.length).toEqual(0)
  })

  test('deduplicates run ids and drops foreign contributions', () => {
    const simId = database.teamDpsSims.addRun(team, makeRun('run1'))
    // duplicate run id is dropped on validation
    database.teamDpsSims.addRun(team, makeRun('run1', { dps: 999 }))
    const sim = database.teamDpsSims.get(simId)!
    expect(sim.runs.length).toEqual(1)
    expect(sim.runs[0].dps).toEqual(100_000)

    // contribution of a character not on the team is dropped
    database.teamDpsSims.addRun(
      team,
      makeRun('run2', {
        contributions: [
          { character: 'RaidenShogun', damage: 1 },
          { character: 'KaedeharaKazuha', damage: 2 },
        ],
      })
    )
    const run2 = database.teamDpsSims.get(simId)!.runs[1]
    expect(run2.contributions).toEqual([
      { character: 'RaidenShogun', damage: 1 },
    ])
  })

  test('removeRun returns the run and removes empty sims', () => {
    const simId = database.teamDpsSims.addRun(team, makeRun('run1'))
    database.teamDpsSims.addRun(team, makeRun('run2'))
    const removed = database.teamDpsSims.removeRun(simId, 'run1')
    expect(removed?.id).toEqual('run1')
    expect(database.teamDpsSims.get(simId)!.runs.length).toEqual(1)
    const removed2 = database.teamDpsSims.removeRun(simId, 'run2')
    expect(removed2?.id).toEqual('run2')
    expect(database.teamDpsSims.get(simId)).toBeUndefined()
    expect(database.teamDpsSims.keys.length).toEqual(0)
  })

  test('rehydrates from storage and exports via GOOD', () => {
    const simId = database.teamDpsSims.addRun(team, makeRun('run1'))
    const reloaded = new ArtCharDatabase(dbIndex, dbStorage)
    expect(reloaded.teamDpsSims.get(simId)!.runs.length).toEqual(1)

    const good = database.exportGOOD() as any
    expect(good.teamDpsSims.length).toEqual(1)
    expect(good.teamDpsSims[0].teamKey).toEqual(
      'Bennett_RaidenShogun_Xiangling_Xingqiu'
    )
  })

  test('helpers pick best run, latest run, and top contributor', () => {
    const a = makeRun('a', { dps: 100, date: 5 })
    const b = makeRun('b', { dps: 300, date: 1 })
    const sim = {
      teamKey: TeamDpsDataManager.toTeamKey(team),
      characters: [...team].sort(),
      runs: [a, b],
      lastEdit: 0,
    }
    expect(bestTeamDpsRun(sim)?.id).toEqual('b')
    expect(latestTeamDpsRun(sim)?.id).toEqual('a')
    expect(teamDpsCharacter(a)).toEqual('RaidenShogun')
  })
})
