import {
  Card,
  CardContent,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { useMemo, useState } from 'react'
import type { Wish } from './types'
import { BANNER_GROUPS, BANNER_NAME, bannerKey } from './types'

const ROWS_PER_PAGE = 100
const RANK_COLOR: Record<string, string> = {
  '5': '#ffd780',
  '4': '#e8b4ff',
  '3': '#9fd0ff',
}

/** Full wish history, newest first. Defaults to 4★+5★ — the rows that matter. */
export default function HistoryTable({ wishes }: { wishes: Wish[] }) {
  const [banner, setBanner] = useState<string>('all')
  const [ranks, setRanks] = useState<string[]>(['4', '5'])
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    const rankSet = new Set(ranks)
    return wishes
      .filter(
        (w) =>
          (banner === 'all' || bannerKey(w) === banner) &&
          (!rankSet.size || rankSet.has(w.rank_type))
      )
      .reverse() // stored ascending; show newest first
  }, [wishes, banner, ranks])

  const pageRows = filtered.slice(
    page * ROWS_PER_PAGE,
    (page + 1) * ROWS_PER_PAGE
  )

  return (
    <Card>
      <CardContent>
        <Stack
          direction="row"
          spacing={2}
          alignItems="center"
          sx={{ mb: 1.5 }}
          flexWrap="wrap"
        >
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            History
          </Typography>
          <ToggleButtonGroup
            size="small"
            value={ranks}
            onChange={(_, value: string[]) => {
              setRanks(value)
              setPage(0)
            }}
          >
            <ToggleButton value="5">5★</ToggleButton>
            <ToggleButton value="4">4★</ToggleButton>
            <ToggleButton value="3">3★</ToggleButton>
          </ToggleButtonGroup>
          <TextField
            select
            size="small"
            label="Banner"
            value={banner}
            onChange={(e) => {
              setBanner(e.target.value)
              setPage(0)
            }}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="all">All banners</MenuItem>
            {BANNER_GROUPS.map(({ key, name }) => (
              <MenuItem key={key} value={key}>
                {name}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Time</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Banner</TableCell>
              <TableCell align="right">Rank</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pageRows.map((w) => (
              <TableRow key={w.id}>
                <TableCell
                  sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}
                >
                  {w.time}
                </TableCell>
                <TableCell sx={{ color: RANK_COLOR[w.rank_type] }}>
                  {w.name}
                </TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>
                  {w.item_type}
                </TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>
                  {BANNER_NAME[w.gacha_type] ?? w.gacha_type}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{ color: RANK_COLOR[w.rank_type] }}
                >
                  {w.rank_type}★
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={filtered.length}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={ROWS_PER_PAGE}
          rowsPerPageOptions={[ROWS_PER_PAGE]}
        />
      </CardContent>
    </Card>
  )
}
