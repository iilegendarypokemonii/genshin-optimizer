import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useIrminsul } from './IrminsulContext'
import type { CaptureMode } from './types'

export function CaptureControls({ standaloneUrl }: { standaloneUrl: string }) {
  const { state, busy, mode, setMode, start, stop } = useIrminsul()
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
        <TextField
          select
          label="Capture method"
          value={mode}
          onChange={(event) => setMode(event.target.value as CaptureMode)}
          disabled={busy || state.capturing}
          helperText="Automatic chooses a method for Windows 10 or 11. No extra driver installation is needed."
          size="small"
          sx={{ mb: 2, minWidth: 280, maxWidth: '100%' }}
        >
          <MenuItem value="auto">Automatic (recommended)</MenuItem>
          <MenuItem value="compatibility">Compatibility (Windows 10)</MenuItem>
        </TextField>
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
