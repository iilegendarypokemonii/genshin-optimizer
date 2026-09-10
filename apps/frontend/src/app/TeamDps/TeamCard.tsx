import { BootstrapTooltip, CardThemed } from '@genshin-optimizer/common/ui'
import type { CharacterKey, ElementKey } from '@genshin-optimizer/gi/consts'
import type { TeamDpsRun, TeamDpsSim } from '@genshin-optimizer/gi/db'
import {
  bestTeamDpsRun,
  latestTeamDpsRun,
  teamDpsCharacter,
} from '@genshin-optimizer/gi/db'
import { useDatabase } from '@genshin-optimizer/gi/db-ui'
import { getCharEle } from '@genshin-optimizer/gi/stats'
import { CharIconSide } from '@genshin-optimizer/gi/ui'
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
import { useState } from 'react'
import type { CharNameMap } from './parse'
import ScreenshotModal from './ScreenshotModal'
import { deleteScreenshot } from './store'

const ELEMENT_HEX: Record<ElementKey, string> = {
  anemo: '#61dbbb',
  geo: '#f8ba4e',
  electro: '#b25dcd',
  hydro: '#5680ff',
  pyro: '#ff3c32',
  cryo: '#77a2e6',
  dendro: '#a5c83b',
}

function ContributionBar({
  run,
  nameMap,
}: {
  run: TeamDpsRun
  nameMap: CharNameMap
}) {
  const total = run.contributions.reduce((a, c) => a + c.damage, 0)
  if (!total) return null
  const sorted = [...run.contributions].sort((a, b) => b.damage - a.damage)
  return (
    <Box
      sx={{
        display: 'flex',
        width: '100%',
        height: 12,
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
}: {
  run: TeamDpsRun
  nameMap: CharNameMap
  onDelete: () => void
}) {
  const [showShot, setShowShot] = useState(false)
  return (
    <Stack direction="row" spacing={1} alignItems="center">
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
  )
}

export default function TeamCard({
  simId,
  sim,
  nameMap,
}: {
  simId: string
  sim: TeamDpsSim
  nameMap: CharNameMap
}) {
  const database = useDatabase()
  const [expanded, setExpanded] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(sim.name ?? '')

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
    if (!window.confirm('Delete this run?')) return
    const removed = database.teamDpsSims.removeRun(simId, run.id)
    if (removed?.hasScreenshot) await deleteScreenshot(removed.id)
  }

  const deleteTeam = async () => {
    if (!window.confirm('Delete this team and all its runs?')) return
    const runs = sim.runs
    database.teamDpsSims.remove(simId)
    for (const run of runs)
      if (run.hasScreenshot) await deleteScreenshot(run.id)
  }

  const saveName = () => {
    database.teamDpsSims.set(simId, { name: nameDraft.trim() })
    setEditingName(false)
  }

  return (
    <CardThemed bgt="light" data-testid="team-dps-card">
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Stack direction="row" spacing={0.5} alignItems="center">
            {ordered.map((ck) => (
              <Box key={ck} sx={{ fontSize: 32, lineHeight: 0 }}>
                <CharIconSide characterKey={ck} />
              </Box>
            ))}
          </Stack>
          {dpsChar && (
            <Chip
              size="small"
              color="warning"
              label={`DPS: ${nameMap[dpsChar] ?? dpsChar}`}
            />
          )}
          <Box sx={{ flexGrow: 1 }} />
          {editingName ? (
            <TextField
              size="small"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => e.key === 'Enter' && saveName()}
              autoFocus
              placeholder="Team label"
            />
          ) : (
            <Stack direction="row" spacing={0.5} alignItems="center">
              {sim.name && (
                <Typography color="text.secondary">{sim.name}</Typography>
              )}
              <IconButton size="small" onClick={() => setEditingName(true)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Stack>
          )}
          <IconButton size="small" color="error" onClick={deleteTeam}>
            <DeleteForeverIcon />
          </IconButton>
        </Stack>
        <Stack direction="row" spacing={2} alignItems="baseline">
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            {best ? best.dps.toLocaleString() : '-'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            best DPS of {sim.runs.length} run{sim.runs.length === 1 ? '' : 's'}
            {latest
              ? `, last ${new Date(latest.date).toLocaleDateString()}`
              : ''}
          </Typography>
        </Stack>
        {best && <ContributionBar run={best} nameMap={nameMap} />}
        <Button
          size="small"
          onClick={() => setExpanded((e) => !e)}
          startIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          sx={{ alignSelf: 'flex-start' }}
        >
          Runs
        </Button>
        <Collapse in={expanded}>
          <Stack spacing={1} divider={<Divider flexItem />}>
            {[...sim.runs]
              .sort((a, b) => b.date - a.date)
              .map((run) => (
                <RunRow
                  key={run.id}
                  run={run}
                  nameMap={nameMap}
                  onDelete={() => deleteRun(run)}
                />
              ))}
          </Stack>
        </Collapse>
      </CardContent>
    </CardThemed>
  )
}
