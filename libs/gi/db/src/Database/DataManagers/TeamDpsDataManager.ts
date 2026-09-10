import { zodEnum } from '@genshin-optimizer/common/database'
import {
  allCharacterKeys,
  type CharacterKey,
} from '@genshin-optimizer/gi/consts'
import { z } from 'zod'
import type { ArtCharDatabase } from '../ArtCharDatabase'
import { DataManager } from '../DataManager'

export const TEAM_DPS_TEAM_SIZE = 4

const contributionSchema = z.object({
  character: zodEnum(allCharacterKeys),
  damage: z.number().min(0).catch(0),
})

const runSchema = z.object({
  id: z.string().min(1),
  date: z.number().catch(0),
  dps: z.number().min(0).catch(0),
  totalDamage: z.number().min(0).catch(0),
  // validated per-element in validate() so one bad entry doesn't drop the rest
  contributions: z.array(z.unknown()).catch([]),
  timeElapsedSec: z.number().min(0).optional(),
  strongestHit: z.number().min(0).optional(),
  uid: z.string().optional(),
  hasScreenshot: z.boolean().catch(false),
  notes: z.string().optional(),
})

const simSchema = z.object({
  teamKey: z.string().catch(''),
  characters: z.array(zodEnum(allCharacterKeys)),
  name: z.string().optional(),
  // validated per-element in validate() so one bad run doesn't drop the rest
  runs: z.array(z.unknown()).catch([]),
  lastEdit: z.number().catch(0),
})

export interface TeamDpsContribution {
  character: CharacterKey
  damage: number
}

/** One uploaded DPS-dummy screenshot / result. */
export interface TeamDpsRun {
  id: string
  date: number
  dps: number
  totalDamage: number
  contributions: TeamDpsContribution[]
  timeElapsedSec?: number
  strongestHit?: number
  uid?: string
  hasScreenshot: boolean
  notes?: string
}

/** All recorded runs for one unique 4-character team. */
export interface TeamDpsSim {
  /** Sorted characters joined by '_'; recomputed on validation. */
  teamKey: string
  characters: CharacterKey[]
  name?: string
  runs: TeamDpsRun[]
  lastEdit: number
}

export class TeamDpsDataManager extends DataManager<
  string,
  'teamDpsSims',
  TeamDpsSim,
  TeamDpsSim,
  ArtCharDatabase
> {
  constructor(database: ArtCharDatabase) {
    super(database, 'teamDpsSims')
    for (const key of this.database.storage.keys)
      if (key.startsWith('teamDpsSim_') && !this.set(key, {}))
        this.database.storage.remove(key)
  }

  override validate(obj: unknown): TeamDpsSim | undefined {
    const parsed = simSchema.safeParse(obj)
    if (!parsed.success) return undefined

    const characters = [...new Set(parsed.data.characters)].sort()
    if (characters.length !== TEAM_DPS_TEAM_SIZE) return undefined
    const teamKey = characters.join('_')
    const charSet = new Set<CharacterKey>(characters)

    const seenRunIds = new Set<string>()
    const runs: TeamDpsRun[] = []
    for (const rawRun of parsed.data.runs) {
      const runParsed = runSchema.safeParse(rawRun)
      if (!runParsed.success) continue
      const {
        id,
        date,
        dps,
        totalDamage,
        contributions: rawContributions,
        timeElapsedSec,
        strongestHit,
        uid,
        hasScreenshot,
        notes,
      } = runParsed.data
      if (seenRunIds.has(id)) continue
      seenRunIds.add(id)

      const contributions: TeamDpsContribution[] = []
      for (const rawContribution of rawContributions) {
        const cParsed = contributionSchema.safeParse(rawContribution)
        if (
          cParsed.success &&
          charSet.has(cParsed.data.character) &&
          !contributions.some((c) => c.character === cParsed.data.character)
        )
          contributions.push(cParsed.data)
      }

      runs.push({
        id,
        date,
        dps,
        totalDamage,
        contributions,
        hasScreenshot,
        ...(timeElapsedSec !== undefined ? { timeElapsedSec } : {}),
        ...(strongestHit !== undefined ? { strongestHit } : {}),
        ...(uid ? { uid } : {}),
        ...(notes ? { notes } : {}),
      })
    }

    const { name, lastEdit } = parsed.data
    return {
      teamKey,
      characters,
      runs,
      lastEdit,
      ...(name ? { name } : {}),
    }
  }

  static toTeamKey(characters: readonly CharacterKey[]): string {
    return [...new Set(characters)].sort().join('_')
  }

  getSimIdByTeam(characters: readonly CharacterKey[]): string | undefined {
    const teamKey = TeamDpsDataManager.toTeamKey(characters)
    return this.entries.find(([, sim]) => sim.teamKey === teamKey)?.[0]
  }

  /**
   * Add a run to the sim for this team, creating the sim when the team is new.
   * Character order does not matter. Returns the sim id, or '' on failure.
   */
  addRun(characters: readonly CharacterKey[], run: TeamDpsRun): string {
    const existingId = this.getSimIdByTeam(characters)
    if (existingId) {
      const sim = this.get(existingId)
      if (!sim) return ''
      if (
        !this.set(existingId, {
          runs: [...sim.runs, run],
          lastEdit: Date.now(),
        })
      )
        return ''
      return existingId
    }
    const id = this.generateKey()
    if (
      !this.set(id, {
        teamKey: '',
        characters: [...characters],
        runs: [run],
        lastEdit: Date.now(),
      })
    )
      return ''
    return id
  }

  /**
   * Remove a run; removes the whole sim when it was the last run.
   * Returns the removed run (e.g. for screenshot cleanup).
   */
  removeRun(simId: string, runId: string): TeamDpsRun | undefined {
    const sim = this.get(simId)
    if (!sim) return undefined
    const run = sim.runs.find((r) => r.id === runId)
    if (!run) return undefined
    const runs = sim.runs.filter((r) => r.id !== runId)
    if (runs.length) this.set(simId, { runs, lastEdit: Date.now() })
    else this.remove(simId)
    return run
  }
}

export function bestTeamDpsRun(sim: TeamDpsSim): TeamDpsRun | undefined {
  return sim.runs.reduce<TeamDpsRun | undefined>(
    (best, run) => (!best || run.dps > best.dps ? run : best),
    undefined
  )
}

export function latestTeamDpsRun(sim: TeamDpsSim): TeamDpsRun | undefined {
  return sim.runs.reduce<TeamDpsRun | undefined>(
    (latest, run) => (!latest || run.date > latest.date ? run : latest),
    undefined
  )
}

/** The team member with the highest damage contribution — "the DPS" of the team. */
export function teamDpsCharacter(run: TeamDpsRun): CharacterKey | undefined {
  return run.contributions.reduce<TeamDpsContribution | undefined>(
    (top, c) => (!top || c.damage > top.damage ? c : top),
    undefined
  )?.character
}
