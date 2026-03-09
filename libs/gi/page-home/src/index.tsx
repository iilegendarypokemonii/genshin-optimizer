import { CardThemed } from '@genshin-optimizer/common/ui'
import { SECOND_MS } from '@genshin-optimizer/common/util'
import { timeZones } from '@genshin-optimizer/gi/db'
import { useDatabase } from '@genshin-optimizer/gi/db-ui'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import { Box, Chip, Stack, Typography } from '@mui/material'
import { useEffect, useMemo, useState } from 'react'

export default function PageHome() {
  const database = useDatabase()
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const tick = () => {
      setTime(new Date())
      return setTimeout(tick, SECOND_MS - (Date.now() % SECOND_MS))
    }
    const timeout = tick()
    return () => clearTimeout(timeout)
  }, [])

  const summary = useMemo(
    () => ({
      characters: database.chars.keys.length,
      artifacts: database.arts.keys.length,
      weapons: database.weapons.keys.length,
      builds:
        database.builds.keys.length +
        database.buildTcs.keys.length +
        database.teamChars.keys.length +
        database.teams.keys.length,
    }),
    [database]
  )
  const serverTimes = useMemo(
    () =>
      [
        { label: 'EU', key: 'Europe' as const },
        { label: 'NA', key: 'America' as const },
        { label: 'ASIA', key: 'Asia' as const },
      ].map(({ label, key }) => ({
        label,
        value: new Date(Date.now() + timeZones[key]).toLocaleTimeString([], {
          timeZone: 'UTC',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }),
      })),
    [time]
  )

  return (
    <Box
      sx={{
        py: { xs: 2, md: 4 },
        px: { xs: 0, md: 2 },
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <CardThemed
        sx={{
          width: '100%',
          maxWidth: 820,
          background:
            'linear-gradient(180deg, rgba(23,27,41,0.96) 0%, rgba(13,16,25,0.98) 100%)',
          border: '1px solid rgba(142, 153, 201, 0.1)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.22)',
        }}
      >
        <Box
          sx={{
            px: { xs: 2.5, md: 4 },
            py: { xs: 3, md: 5 },
            display: 'grid',
            gap: 3,
          }}
        >
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="flex-start"
            spacing={2}
          >
            <Box>
              <Typography
                variant="overline"
                sx={{ color: 'neutral300.main', letterSpacing: '0.2em' }}
              >
                LOCAL DESKTOP
              </Typography>
              <Typography
                variant="h3"
                sx={{
                  mt: 0.75,
                  fontWeight: 700,
                  lineHeight: 0.95,
                }}
              >
                Genshin Optimizer
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  mt: 1.25,
                  maxWidth: 560,
                  color: 'neutral300.main',
                }}
              >
                A quiet start page for the desktop app. Use the top bar to jump
                straight into your roster, artifacts, teams, and builds.
              </Typography>
            </Box>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              useFlexGap
              flexWrap="wrap"
              sx={{ mt: 0.5 }}
            >
              {serverTimes.map(({ label, value }) => (
                <Chip
                  key={label}
                  icon={<AutoAwesomeIcon />}
                  label={`${label} ${value}`}
                  sx={{
                    bgcolor:
                      label === 'EU'
                        ? 'rgba(122, 210, 164, 0.12)'
                        : 'rgba(255,255,255,0.06)',
                    color: 'neutral100.main',
                    borderRadius: 999,
                    px: 1,
                  }}
                />
              ))}
            </Stack>
          </Stack>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
                md: 'repeat(4, minmax(0, 1fr))',
              },
              gap: 1,
            }}
          >
            <SummaryStat label="Characters" value={`${summary.characters}`} />
            <SummaryStat label="Artifacts" value={`${summary.artifacts}`} />
            <SummaryStat label="Weapons" value={`${summary.weapons}`} />
            <SummaryStat label="Builds" value={`${summary.builds}`} />
          </Box>
        </Box>
      </CardThemed>
    </Box>
  )
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <Box
      sx={{
        px: 1.75,
        py: 1.5,
        borderRadius: 1.25,
        bgcolor: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <Typography variant="caption" sx={{ color: 'neutral300.main' }}>
        {label}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
        {value}
      </Typography>
    </Box>
  )
}
