import {
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  Stack,
  Typography,
} from '@mui/material'
import type { Dispatch, SetStateAction } from 'react'
import { type DatabaseInfo, slotLabel } from '../WishTracker/useDatabaseInfos'
import type { SnapshotSummary } from './types'

export function BatchAccountSelection({
  snapshots,
  dbInfos,
  excludedUids,
  setExcludedUids,
  working,
  canImport,
  selectedCount,
  invalidate,
  review,
}: {
  snapshots: SnapshotSummary[]
  dbInfos: DatabaseInfo[]
  excludedUids: string[]
  setExcludedUids: Dispatch<SetStateAction<string[]>>
  working: boolean
  canImport: boolean
  selectedCount: number
  invalidate: () => void
  review: () => void
}) {
  if (snapshots.length < 2) return null
  return (
    <Card>
      <CardContent>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Typography variant="h6">Import multiple accounts</Typography>
          <Button
            disabled={working}
            onClick={() => {
              setExcludedUids([])
              invalidate()
            }}
          >
            Select all
          </Button>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>
          Review the login snapshots together after playing. Each account uses
          its own UID, destination, and backup. Loot or upgrades after login are
          not included.
        </Typography>
        <Stack>
          {snapshots.map((snapshot) => (
            <FormControlLabel
              key={snapshot.uid}
              label={`${slotLabel(dbInfos, snapshot.uid) ?? 'Account'} · ${snapshot.uid} · captured ${new Date(snapshot.capturedAtMs).toLocaleTimeString()}`}
              control={
                <Checkbox
                  disabled={working}
                  checked={!excludedUids.includes(snapshot.uid)}
                  onChange={(_, checked) => {
                    setExcludedUids((current) =>
                      checked
                        ? current.filter((uid) => uid !== snapshot.uid)
                        : [...current, snapshot.uid]
                    )
                    invalidate()
                  }}
                />
              }
            />
          ))}
        </Stack>
        <Button
          sx={{ mt: 1 }}
          variant="contained"
          disabled={working || !canImport || !selectedCount}
          onClick={review}
        >
          Review selected accounts ({selectedCount})
        </Button>
      </CardContent>
    </Card>
  )
}
