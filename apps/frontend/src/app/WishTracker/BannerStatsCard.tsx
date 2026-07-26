import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import {
  Alert,
  Box,
  Card,
  CardContent,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import {
  capturingRadianceWinChance,
  type BannerStats,
} from './pity'

function pityColor(pity: number): string {
  if (pity <= 40) return '#7fe08a'
  if (pity <= 70) return '#ffd780'
  return '#ff8a8a'
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Typography
      variant="body2"
      color="text.secondary"
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'baseline',
        columnGap: 0.5,
        lineHeight: 1.5,
        whiteSpace: 'nowrap',
      }}
    >
      <span>{label}</span>
      <strong style={{ color: 'white' }}>{value}</strong>
    </Typography>
  )
}

function radianceTooltip(stats: BannerStats): string {
  const radianceChance = capturingRadianceWinChance(
    stats.capturingRadianceScore ?? 1
  )

  if (stats.featuredCharacterGuaranteed) {
    return `Current featured-character chance: 100% from the standard guarantee after an off-banner 5-star. This guarantee is separate from radiance; after it, the modeled next non-guaranteed chance is ${radianceChance}%.`
  }

  if (radianceChance === 100) {
    return 'Current featured-character chance: 100% in the theoretical radiance model. There is no separate standard guarantee active.'
  }

  if (radianceChance === 55) {
    return 'Current featured-character chance: 55% in the Hu Tao calculator\'s theoretical radiance model. HoYoverse does not publish this per-state rate.'
  }

  return 'Current featured-character chance: 50% in the Hu Tao calculator\'s theoretical radiance model. HoYoverse publishes a 55% consolidated long-run rate, not a per-state table.'
}

export default function BannerStatsCard({
  stats,
  onSetCapturingRadiance,
}: {
  stats: BannerStats
  onSetCapturingRadiance?: (wishId: string, confirmed: boolean) => Promise<void>
}) {
  const [savingWishId, setSavingWishId] = useState<string>()
  const [annotationError, setAnnotationError] = useState<string>()
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  const newestFiveStars = [...stats.fiveStars].reverse()
  const visibleFiveStars = newestFiveStars.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  )

  async function setRadiance(wishId: string, confirmed: boolean) {
    if (!onSetCapturingRadiance) return
    setSavingWishId(wishId)
    setAnnotationError(undefined)
    try {
      await onSetCapturingRadiance(wishId, confirmed)
    } catch (e) {
      setAnnotationError(e instanceof Error ? e.message : String(e))
    } finally {
      setSavingWishId(undefined)
    }
  }

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" sx={{ color: '#ffd780', mb: 0.5 }}>
          {stats.name}
        </Typography>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'baseline',
            flexWrap: 'wrap',
            gap: '0.3em 1em',
            mb: 1,
          }}
        >
          <Stat label="wishes" value={stats.total} />
          <Stat label="5★" value={stats.fiveStarCount} />
          <Stat
            label="avg 5★ pity"
            value={stats.avgPity5 ? stats.avgPity5.toFixed(1) : '-'}
          />
          <Stat label="current pity" value={stats.currentPity5} />
          {stats.key === '301' &&
            stats.capturingRadianceScore !== undefined && (
              <Tooltip title={radianceTooltip(stats)}>
                <Box component="span" sx={{ display: 'inline-flex' }}>
                  <Stat
                    label="radiance"
                    value={stats.capturingRadianceScore}
                  />
                </Box>
              </Tooltip>
            )}
          <Stat label="4★ pity" value={stats.currentPity4} />
          <Stat label="primos" value={stats.primosSpent.toLocaleString()} />
        </Box>
        {annotationError && (
          <Alert severity="error" sx={{ mb: 1 }}>
            {annotationError}
          </Alert>
        )}
        {!!stats.fiveStars.length && (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>5★ Pull</TableCell>
                <TableCell align="right">Pity</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleFiveStars.map(({ wish, pity }) => (
                <TableRow key={wish.id}>
                  <TableCell
                    sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}
                  >
                    {wish.time.slice(0, 10)}
                  </TableCell>
                  <TableCell>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 0.5,
                      }}
                    >
                      <Box
                        component="span"
                        sx={{
                          color:
                            wish.item_type === 'Character'
                              ? '#e8b4ff'
                              : '#9fd0ff',
                        }}
                      >
                        {wish.name}
                      </Box>
                      {stats.key === '301' &&
                        wish.item_type === 'Character' && (
                          <Box
                            sx={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 0.25,
                            }}
                          >
                            <Tooltip
                              title={
                                wish.capturingRadiance
                                  ? 'Remove Capturing Radiance mark'
                                  : 'Mark as Capturing Radiance'
                              }
                            >
                              <span>
                                <IconButton
                                  size="small"
                                  aria-label={
                                    wish.capturingRadiance
                                      ? 'Remove Capturing Radiance mark'
                                      : 'Mark as Capturing Radiance'
                                  }
                                  disabled={savingWishId === wish.id}
                                  onClick={() =>
                                    void setRadiance(
                                      wish.id,
                                      !wish.capturingRadiance
                                    )
                                  }
                                  sx={{
                                    p: 0.25,
                                    color: wish.capturingRadiance
                                      ? 'warning.main'
                                      : 'text.disabled',
                                  }}
                                >
                                  <AutoAwesomeIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            {wish.capturingRadiance && (
                              <Typography
                                variant="caption"
                                sx={{
                                  color: 'warning.main',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                Capturing Radiance
                              </Typography>
                            )}
                          </Box>
                        )}
                    </Box>
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      color: pityColor(pity),
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {pity}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {stats.fiveStars.length > 5 && (
          <TablePagination
            component="div"
            count={stats.fiveStars.length}
            page={page}
            onPageChange={(_, nextPage) => setPage(nextPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(event) => {
              setRowsPerPage(parseInt(event.target.value, 10))
              setPage(0)
            }}
            rowsPerPageOptions={[5, 10, 25, 50]}
            labelRowsPerPage="5★ per page"
          />
        )}
      </CardContent>
    </Card>
  )
}
