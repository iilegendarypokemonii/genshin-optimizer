import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from '@mui/material'
import { useIrminsul } from './IrminsulContext'

export function CaptureControls({ standaloneUrl }: { standaloneUrl: string }) {
  const { state, busy, start, stop } = useIrminsul()
  return (
    <Card>
      <CardContent>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          spacing={2}
        >
          <Typography variant="h6">Capture account data</Typography>
          <Chip
            label={state.capturing ? 'Capture running' : 'Capture stopped'}
            color={state.capturing ? 'success' : 'default'}
          />
        </Stack>
        <Typography sx={{ mt: 1 }}>
          Start capture, allow the Windows permission prompt, then log in and
          enter the game door. Keep capture running while switching accounts.
        </Typography>
        <Typography color="text.secondary" variant="body2" sx={{ mt: 1 }}>
          Capture can run for up to four hours. Each login creates a snapshot
          for its captured UID. Wishes use the separate wish-history authkey;
          account-data capture does not need it.
        </Typography>
        <Typography role="status" sx={{ my: 2 }}>
          {state.message}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            disabled={busy || state.capturing}
            onClick={() => void start()}
          >
            Start capture
          </Button>
          <Button
            variant="outlined"
            disabled={busy || !state.capturing}
            onClick={() => void stop()}
          >
            Stop capture
          </Button>
          <Button
            component="a"
            href={standaloneUrl}
            target="_blank"
            rel="noreferrer"
          >
            Standalone version
          </Button>
        </Stack>
      </CardContent>
    </Card>
  )
}

export function CaptureMessages({
  error,
  notice,
}: {
  error: string
  notice: string
}) {
  const { state, error: captureError } = useIrminsul()
  return (
    <>
      {(error || captureError || state.phase === 'error') && (
        <Alert severity="error">{error || captureError || state.message}</Alert>
      )}
      {notice && <Alert severity="success">{notice}</Alert>}
    </>
  )
}
