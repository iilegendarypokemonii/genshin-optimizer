import RefreshIcon from '@mui/icons-material/Refresh'
import VideogameAssetIcon from '@mui/icons-material/VideogameAsset'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { useWishTracker } from './WishTrackerContext'
import type { SyncOutcome } from './cacheWatch'
import type { CacheKeyState } from './types'
import {
  bySlotLabel,
  slotLabel,
  timeAgo,
  useDatabaseInfos,
} from './useDatabaseInfos'

function keyStatusChip(keyState?: CacheKeyState) {
  switch (keyState?.status) {
    case 'valid':
      return <Chip size="small" color="success" label="authkey valid" />
    case 'expired':
      return <Chip size="small" color="warning" label="authkey expired" />
    default:
      return <Chip size="small" label="authkey unknown" />
  }
}

function outcomeText(outcome?: SyncOutcome): string | undefined {
  switch (outcome?.kind) {
    case 'no-cache':
      return outcome.message
    case 'expired':
    case 'skipped':
      return 'Open the wish history screen in-game to enable syncing.'
    case 'synced':
      return outcome.added
        ? `Synced ${outcome.added} new wishes.`
        : 'Up to date.'
    case 'no-wishes':
      return 'The account in cache has no wishes yet.'
    case 'new-uid':
      return `${outcome.uid} has no stored wish history yet.`
    case 'identified':
      return undefined // the "Account in cache" line already shows it
    case 'error':
      return outcome.message
    default:
      return undefined
  }
}

/** Game-cache status + per-profile staleness; shown on Home and the tracker page. */
export default function CacheStatusCard({
  compact = false,
}: {
  compact?: boolean
}) {
  const {
    isDesktop,
    profiles,
    keyState,
    lastOutcome,
    syncing,
    syncNow,
    checkCache,
    createProfileFor,
  } = useWishTracker()
  const dbInfos = useDatabaseInfos()
  const navigate = useNavigate()
  if (!isDesktop) return null

  const cachedUid = keyState?.uid
  const cachedLabel = cachedUid ? slotLabel(dbInfos, cachedUid) : undefined
  const irminsulHint =
    keyState?.status === 'valid' && cachedUid
      ? `${cachedLabel ?? cachedUid} was last active — good moment to run Irminsul for it.`
      : undefined

  return (
    <Card data-testid="cache-status-card">
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <VideogameAssetIcon fontSize="small" />
          <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
            Game cache
          </Typography>
          {keyStatusChip(keyState)}
          <Tooltip title="Re-check which account is in the cache (no wish sync)">
            <span>
              <IconButton
                size="small"
                disabled={syncing}
                onClick={() => void checkCache()}
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>

        <Typography variant="body2" color="text.secondary">
          {cachedUid
            ? `Account in cache: ${cachedUid}${cachedLabel ? ` (${cachedLabel})` : ''}`
            : keyState?.url
              ? 'Account in cache: identifying…'
              : 'No wish-history URL seen yet.'}
        </Typography>
        {outcomeText(lastOutcome) && (
          <Typography variant="body2" color="text.secondary">
            {outcomeText(lastOutcome)}
          </Typography>
        )}
        {irminsulHint && (
          <Typography variant="body2" sx={{ color: 'success.light' }}>
            {irminsulHint}
          </Typography>
        )}

        {!compact && !!profiles?.length && (
          <Box sx={{ mt: 1 }}>
            {[...profiles].sort(bySlotLabel(dbInfos)).map((p) => {
              const label = slotLabel(dbInfos, p.uid)
              return (
                <Typography key={p.uid} variant="body2" color="text.secondary">
                  {label ? `${label} (${p.uid})` : p.uid}: synced{' '}
                  {timeAgo(p.lastSyncMs)}
                </Typography>
              )
            })}
          </Box>
        )}

        <Stack
          direction="row"
          spacing={1}
          sx={{ mt: 1.5 }}
          flexWrap="wrap"
          useFlexGap
        >
          {lastOutcome?.kind === 'new-uid' && (
            <Button
              size="small"
              variant="contained"
              color="success"
              disabled={syncing}
              onClick={() => void createProfileFor(lastOutcome.uid)}
            >
              {`Track wishes for ${slotLabel(dbInfos, lastOutcome.uid) ?? lastOutcome.uid}`}
            </Button>
          )}
          <Button
            size="small"
            variant="contained"
            startIcon={<RefreshIcon />}
            disabled={syncing}
            onClick={() => void syncNow()}
          >
            {syncing ? 'Syncing…' : 'Sync wishes now'}
          </Button>
          {!compact && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => navigate('/tools/wish-tracker')}
            >
              Open wish tracker
            </Button>
          )}
        </Stack>
      </CardContent>
    </Card>
  )
}
