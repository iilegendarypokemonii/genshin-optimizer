import UpdateIcon from '@mui/icons-material/Update'
import { Box, Chip, Stack, Typography } from '@mui/material'
import { useMemo } from 'react'

declare const __VERSION__: string
declare const __BUILD_DATE__: string

const VERSION = typeof __VERSION__ === 'undefined' ? '' : __VERSION__
const BUILD_DATE = typeof __BUILD_DATE__ === 'undefined' ? '' : __BUILD_DATE__

const DAY_MS = 24 * 60 * 60 * 1000
const PATCH_MS = 42 * DAY_MS
const PHASE_MS = 21 * DAY_MS

// Known patch dates (UTC). Extend when HoYo announces new anchors; patches
// after the last anchor are extrapolated on the 42-day cadence.
const ANCHORS: { version: string; name?: string; date: number }[] = [
  { version: '6.7', date: Date.UTC(2026, 6, 1) },
  { version: '7.0', name: 'Snezhnaya', date: Date.UTC(2026, 7, 12) },
]
const EXTRAPOLATED_PATCHES = 7

type GameEvent = { label: string; date: number }

function buildEvents(): GameEvent[] {
  const patches = [...ANCHORS]
  const last = ANCHORS[ANCHORS.length - 1]
  const [major, minor] = last.version.split('.').map(Number)
  for (let i = 1; i <= EXTRAPOLATED_PATCHES; i++)
    patches.push({
      version: `${major}.${minor + i}`,
      date: last.date + i * PATCH_MS,
    })
  return patches
    .flatMap(({ version, name, date }) => [
      { label: `${version}${name ? ` ${name}` : ''}`, date },
      { label: `${version} second half`, date: date + PHASE_MS },
    ])
    .sort((a, b) => a.date - b.date)
}

function fmtDate(date: number) {
  return new Date(date).toLocaleDateString([], {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function UpdateReminder() {
  const { pending, upcoming } = useMemo(() => {
    const events = buildEvents()
    const now = Date.now()
    const synced = BUILD_DATE ? Date.parse(BUILD_DATE) : now
    return {
      // Went live after the last data sync (= exe build) — nudge to update.
      pending: events.filter((e) => e.date > synced && e.date <= now),
      upcoming: events.filter((e) => e.date > now).slice(0, 2),
    }
  }, [])

  return (
    <Box
      sx={{
        px: 1.75,
        py: 1.5,
        borderRadius: 1.25,
        bgcolor: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
        display: 'grid',
        gap: 1,
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        spacing={1}
      >
        <Typography variant="caption" sx={{ color: 'neutral300.main' }}>
          Game data
        </Typography>
        <Chip
          size="small"
          icon={<UpdateIcon />}
          label={`GO v${VERSION}${BUILD_DATE ? ` · synced ${BUILD_DATE}` : ''}`}
          sx={{
            bgcolor: 'rgba(255,255,255,0.06)',
            color: 'neutral100.main',
            borderRadius: 999,
          }}
        />
      </Stack>
      {pending.map(({ label, date }) => (
        <Typography
          key={label}
          variant="body2"
          sx={{ color: 'warning.main', fontWeight: 600 }}
        >
          {label} went live {fmtDate(date)} — upstream data usually lands
          within 0–3 days, time to sync the fork.
        </Typography>
      ))}
      {upcoming.map(({ label, date }) => {
        const days = Math.ceil((date - Date.now()) / DAY_MS)
        return (
          <Typography
            key={label}
            variant="body2"
            sx={{ color: 'neutral300.main' }}
          >
            <Box component="span" sx={{ color: 'neutral100.main' }}>
              {label}
            </Box>
            {` — ${fmtDate(date)} (in ${days} day${days === 1 ? '' : 's'})`}
          </Typography>
        )
      })}
    </Box>
  )
}
