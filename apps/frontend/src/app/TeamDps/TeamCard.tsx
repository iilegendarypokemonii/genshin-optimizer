import { BootstrapTooltip, CardThemed } from '@genshin-optimizer/common/ui'
import type { CharacterKey, ElementKey } from '@genshin-optimizer/gi/consts'
import type {
  ArtCharDatabase,
  TeamDpsRun,
  TeamDpsSim,
} from '@genshin-optimizer/gi/db'
import {
  bestTeamDpsRun,
  latestTeamDpsRun,
  teamDpsCharacter,
} from '@genshin-optimizer/gi/db'
import { useDBMeta } from '@genshin-optimizer/gi/db-ui'
import { getCharEle } from '@genshin-optimizer/gi/stats'
import { iconAsset, SillyContext } from '@genshin-optimizer/gi/ui'
import DeleteForeverIcon from '@mui/icons-material/DeleteForever'
import EditIcon from '@mui/icons-material/Edit'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ImageIcon from '@mui/icons-material/Image'
import ImageNotSupportedIcon from '@mui/icons-material/ImageNotSupported'
import {
  Box,
  Button,
  CardContent,
  Chip,
  Collapse,
  Divider,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useContext, useState } from 'react'
import type { CharNameMap } from './parse'
import { patchForDate } from './patch'
import ScreenshotModal from './ScreenshotModal'
import { confirmDialog, deleteScreenshot } from './store'

const ELEMENT_HEX: Record<ElementKey, string> = {
  anemo: '#61dbbb',
  geo: '#f8ba4e',
  electro: '#b25dcd',
  hydro: '#5680ff',
  pyro: '#ff3c32',
  cryo: '#77a2e6',
  dendro: '#a5c83b',
}
const DPS_GOLD = '#ffb300'

function ContributionBar({
  run,
  nameMap,
  height = 8,
}: {
  run: TeamDpsRun
  nameMap: CharNameMap
  height?: number
}) {
  const total = run.contributions.reduce((a, c) => a + c.damage, 0)
  if (!total) return null
  const sorted = [...run.contributions].sort((a, b) => b.damage - a.damage)
  return (
    <Box
      sx={{
        display: 'flex',
        width: '100%',
        height,
        borderRadius: 1,
        overflow: 'hidden',
      }}
    >
      {sorted.map((c) => (
        <BootstrapTooltip
          key={c.character}
          title={`${nameMap[c.character] ?? c.character}: ${c.damage.toLocaleString()} (${Math.round((c.damage / total) * 100)}%)`}
        >
          <Box
            sx={{
              width: `${(c.damage / total) * 100}%`,
              bgcolor: ELEMENT_HEX[getCharEle(c.character)] ?? '#888888',
            }}
          />
        </BootstrapTooltip>
      ))}
    </Box>
  )
}

function RunRow({
  run,
  nameMap,
  onDelete,
  onSaveNotes,
}: {
  run: TeamDpsRun
  nameMap: CharNameMap
  onDelete: () => void
  onSaveNotes: (notes: string) => void
}) {
  const [showShot, setShowShot] = useState(false)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesDraft, setNotesDraft] = useState('')
  return (
    <Stack spacing={0.25}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ minWidth: 28, fontWeight: 600 }}
        >
          {run.patch ?? patchForDate(run.date) ?? '-'}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ minWidth: 110 }}
        >
          {new Date(run.date).toLocaleDateString()}{' '}
          {new Date(run.date).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Typography>
        <Typography sx={{ fontWeight: 600, minWidth: 90 }}>
          {run.dps.toLocaleString()}
        </Typography>
        <Box sx={{ flexGrow: 1 }}>
          <ContributionBar run={run} nameMap={nameMap} />
        </Box>
        {run.timeElapsedSec !== undefined && (
          <Typography variant="caption" color="text.secondary">
            {run.timeElapsedSec}s
          </Typography>
        )}
        <IconButton
          size="small"
          onClick={() => {
            setNotesDraft(run.notes ?? '')
            setEditingNotes(true)
          }}
        >
          <EditIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          disabled={!run.hasScreenshot}
          onClick={() => setShowShot(true)}
        >
          {run.hasScreenshot ? (
            <ImageIcon fontSize="small" />
          ) : (
            <ImageNotSupportedIcon fontSize="small" />
          )}
        </IconButton>
        <IconButton size="small" color="error" onClick={onDelete}>
          <DeleteForeverIcon fontSize="small" />
        </IconButton>
        <ScreenshotModal
          runId={run.id}
          show={showShot}
          onClose={() => setShowShot(false)}
        />
      </Stack>
      {editingNotes ? (
        <TextField
          size="small"
          fullWidth
          multiline
          maxRows={3}
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
          onBlur={() => {
            onSaveNotes(notesDraft)
            setEditingNotes(false)
          }}
          autoFocus
          placeholder="Run notes - e.g. good vs a Stygian boss, or what to improve"
        />
      ) : (
        (run.notes || run.reactions) && (
          <Typography variant="caption" color="text.secondary">
            {[run.notes, run.reactions].filter(Boolean).join('  |  ')}
          </Typography>
        )
      )}
    </Stack>
  )
}

export default function TeamCard({
  rank,
  simId,
  sim,
  nameMap,
  database,
  sourceLabel,
}: {
  /** Position in the currently sorted and filtered list. */
  rank: number
  simId: string
  sim: TeamDpsSim
  nameMap: CharNameMap
  /** The database slot owning this sim; edits and deletes route here. */
  database: ArtCharDatabase
  /** Shown when the sim comes from a non-active database slot. */
  sourceLabel?: string
}) {
  const { gender } = useDBMeta()
  const { silly } = useContext(SillyContext)
  const [expanded, setExpanded] = useState(false)

  const best = bestTeamDpsRun(sim)
  const latest = latestTeamDpsRun(sim)
  const dpsChar = best && teamDpsCharacter(best)

  // display characters ordered by best-run contribution, remaining members after
  const ordered: CharacterKey[] = best
    ? [
        ...[...best.contributions]
          .sort((a, b) => b.damage - a.damage)
          .map((c) => c.character),
        ...sim.characters.filter(
          (ck) => !best.contributions.some((c) => c.character === ck)
        ),
      ]
    : [...sim.characters]

  const deleteRun = async (run: TeamDpsRun) => {
    if (!(await confirmDialog('Delete this run?'))) return
    const removed = database.teamDpsSims.removeRun(simId, run.id)
    if (removed?.hasScreenshot) await deleteScreenshot(removed.id)
  }

  const deleteTeam = async () => {
    if (!(await confirmDialog('Delete this team and all its runs?'))) return
    const runs = sim.runs
    database.teamDpsSims.remove(simId)
    for (const run of runs)
      if (run.hasScreenshot) await deleteScreenshot(run.id)
  }

  const saveRunNotes = (runId: string, notes: string) => {
    database.teamDpsSims.set(simId, {
      runs: sim.runs.map((r) =>
        r.id === runId ? { ...r, notes: notes.trim() || undefined } : r
      ),
      lastEdit: Date.now(),
    })
  }

  return (
    <CardThemed bgt="light" data-testid="team-dps-card">
      <CardContent
        sx={{
          py: 0.75,
          px: 1.5,
          '&:last-child': { pb: 0.75 },
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ minWidth: 22, textAlign: 'right', fontWeight: 700 }}
          >
            {rank}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {ordered.map((ck, i) => (
              <BootstrapTooltip
                key={ck}
                title={`${nameMap[ck] ?? ck}${ck === dpsChar ? ' (DPS)' : ''}`}
              >
                <Box
                  component="img"
                  src={iconAsset(ck, gender, silly)}
                  alt={nameMap[ck] ?? ck}
                  sx={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '2px solid',
                    borderColor:
                      ck === dpsChar
                        ? DPS_GOLD
                        : (ELEMENT_HEX[getCharEle(ck)] ?? '#888888'),
                    bgcolor: 'contentDark.main',
                    ml: i ? -0.75 : 0,
                    zIndex: ordered.length - i,
                    position: 'relative',
                  }}
                />
              </BootstrapTooltip>
            ))}
          </Box>
          {sourceLabel && (
            <Chip
              size="small"
              variant="outlined"
              label={sourceLabel}
              sx={{ flexShrink: 0 }}
            />
          )}
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              minWidth: 96,
              textAlign: 'right',
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            {best ? best.dps.toLocaleString() : '-'}
          </Typography>
          <Box sx={{ width: 200, flexShrink: 0 }}>
            {best && <ContributionBar run={best} nameMap={nameMap} />}
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          <Typography
            variant="caption"
            color="text.secondary"
            noWrap
            sx={{ flexShrink: 0 }}
          >
            {sim.runs.length} run{sim.runs.length === 1 ? '' : 's'}
            {latest ? `, ${new Date(latest.date).toLocaleDateString()}` : ''}
          </Typography>
          <IconButton size="small" onClick={() => setExpanded((e) => !e)}>
            {expanded ? (
              <ExpandLessIcon fontSize="small" />
            ) : (
              <ExpandMoreIcon fontSize="small" />
            )}
          </IconButton>
        </Stack>
        <Collapse in={expanded}>
          <Stack spacing={1} sx={{ pt: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ flexGrow: 1 }} />
              <Button
                size="small"
                color="error"
                startIcon={<DeleteForeverIcon fontSize="small" />}
                onClick={deleteTeam}
                sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
              >
                Delete team
              </Button>
            </Stack>
            <Divider />
            {[...sim.runs]
              .sort((a, b) => b.date - a.date)
              .map((run) => (
                <RunRow
                  key={run.id}
                  run={run}
                  nameMap={nameMap}
                  onDelete={() => deleteRun(run)}
                  onSaveNotes={(notes) => saveRunNotes(run.id, notes)}
                />
              ))}
          </Stack>
        </Collapse>
      </CardContent>
    </CardThemed>
  )
}
