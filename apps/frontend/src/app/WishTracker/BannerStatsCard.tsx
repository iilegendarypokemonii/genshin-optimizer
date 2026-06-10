import {
  Box,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import type { BannerStats } from './pity'

function pityColor(pity: number): string {
  if (pity <= 40) return '#7fe08a'
  if (pity <= 70) return '#ffd780'
  return '#ff8a8a'
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Typography variant="body2" color="text.secondary" component="span">
      {label} <strong style={{ color: 'white' }}>{value}</strong>
    </Typography>
  )
}

export default function BannerStatsCard({ stats }: { stats: BannerStats }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" sx={{ color: '#ffd780', mb: 0.5 }}>
          {stats.name}
        </Typography>
        <Box
          sx={{ display: 'flex', flexWrap: 'wrap', gap: '0.3em 1em', mb: 1 }}
        >
          <Stat label="wishes" value={stats.total} />
          <Stat label="5★" value={stats.fiveStarCount} />
          <Stat
            label="avg 5★ pity"
            value={stats.avgPity5 ? stats.avgPity5.toFixed(1) : '-'}
          />
          <Stat label="current pity" value={stats.currentPity5} />
          <Stat label="4★ pity" value={stats.currentPity4} />
          <Stat label="primos" value={stats.primosSpent.toLocaleString()} />
        </Box>
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
              {[...stats.fiveStars].reverse().map(({ wish, pity }) => (
                <TableRow key={wish.id}>
                  <TableCell
                    sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}
                  >
                    {wish.time.slice(0, 10)}
                  </TableCell>
                  <TableCell
                    sx={{
                      color:
                        wish.item_type === 'Character' ? '#e8b4ff' : '#9fd0ff',
                    }}
                  >
                    {wish.name}
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
      </CardContent>
    </Card>
  )
}
