import { isTauri } from '@genshin-optimizer/common/util'
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Typography,
} from '@mui/material'
import type { DownloadEvent, Update } from '@tauri-apps/plugin-updater'
import { useRef, useState } from 'react'
import { pauseDesktopWrites, resumeDesktopWrites } from '../desktopWriteBarrier'
import { flushDesktopStorage } from '../persistentStorage'

type Status =
  | 'idle'
  | 'checking'
  | 'current'
  | 'available'
  | 'downloading'
  | 'saving'
  | 'installing'
  | 'error'

const messages: Record<Status, string> = {
  idle: '',
  checking: 'Checking for updates…',
  current: 'You have the latest desktop release.',
  available: 'A new desktop release is ready to install.',
  downloading: 'Downloading update… Please keep the app open.',
  saving: 'Saving your changes before updating…',
  installing: 'Installing update… The app will close and restart.',
  error: '',
}

const installErrors = {
  downloading:
    'The update could not be downloaded or verified. You can keep using the app and try again.',
  saving:
    'Your changes could not be saved, so the update was not installed. Keep the app open and export a backup of your data. If this persists, use the latest installer after securing your backup.',
  installing:
    'The update could not be installed. Close the app and run the latest installer, or try again.',
}

export default function DesktopUpdates() {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [currentVersion, setCurrentVersion] = useState('')
  const [progress, setProgress] = useState<number>()
  const [error, setError] = useState('')
  const update = useRef<Update | null>(null)
  const busy = useRef(false)

  if (!isTauri()) return null

  async function releaseUpdate() {
    const previous = update.current
    update.current = null
    await previous?.close().catch((cause) => console.error(cause))
  }

  async function checkForUpdates() {
    if (busy.current) return
    busy.current = true
    setOpen(true)
    setStatus('checking')
    setProgress(undefined)
    setError('')
    try {
      await releaseUpdate()
      const { getVersion } = await import('@tauri-apps/api/app')
      const { check } = await import('@tauri-apps/plugin-updater')
      setCurrentVersion(await getVersion())
      update.current = await check({ timeout: 20_000 })
      setStatus(update.current ? 'available' : 'current')
    } catch (cause) {
      console.error('Desktop update check failed', cause)
      setError(
        'Could not check for updates. Check your internet connection and try again. You can continue using this version.'
      )
      setStatus('error')
    } finally {
      busy.current = false
    }
  }

  async function installUpdate() {
    const available = update.current
    if (busy.current || !available) return
    busy.current = true
    setStatus('downloading')
    setProgress(undefined)
    let downloaded = 0
    let total: number | undefined
    let phase: keyof typeof installErrors = 'downloading'
    function onDownload(event: DownloadEvent) {
      if (event.event === 'Started') total = event.data.contentLength
      if (event.event === 'Progress') downloaded += event.data.chunkLength
      if (total) setProgress(Math.min(100, (downloaded / total) * 100))
    }
    try {
      // download() verifies the signature before install() can run.
      await available.download(onDownload, { timeout: 300_000 })
      phase = 'saving'
      setStatus('saving')
      setProgress(undefined)
      await pauseDesktopWrites()
      await flushDesktopStorage()
      phase = 'installing'
      setStatus('installing')
      await available.install()
      // Windows normally exits inside install(); this covers other platforms.
      const { relaunch } = await import('@tauri-apps/plugin-process')
      await relaunch()
    } catch (cause) {
      console.error('Desktop update installation failed', cause)
      setError(installErrors[phase])
      setStatus('error')
      await releaseUpdate()
    } finally {
      resumeDesktopWrites()
      busy.current = false
    }
  }

  function dismiss() {
    if (busy.current) return
    setOpen(false)
    void releaseUpdate()
  }

  const working = ['checking', 'downloading', 'saving', 'installing'].includes(
    status
  )
  return (
    <>
      <Button
        size="small"
        startIcon={<SystemUpdateAltIcon />}
        onClick={() => void checkForUpdates()}
        disabled={working}
        sx={{ whiteSpace: 'nowrap' }}
      >
        Check for updates
      </Button>
      <Dialog
        open={open}
        onClose={dismiss}
        disableEscapeKeyDown={working}
        fullWidth
        maxWidth="sm"
        aria-labelledby="desktop-update-title"
      >
        <DialogTitle id="desktop-update-title">Desktop updates</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2 }}>
          {currentVersion && (
            <Typography variant="body2" color="text.secondary">
              Installed desktop version: {currentVersion}
            </Typography>
          )}
          <Box role="status" aria-live="polite">
            {messages[status]}
          </Box>
          {working && (
            <LinearProgress
              aria-label="Update progress"
              variant={progress === undefined ? 'indeterminate' : 'determinate'}
              value={progress}
            />
          )}
          <UpdateReleaseNotes status={status} update={update.current} />
          {error && <Alert severity="error">{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={dismiss} disabled={working}>
            {status === 'available' ? 'Later' : 'Close'}
          </Button>
          {status === 'error' && (
            <Button onClick={() => void checkForUpdates()}>Try again</Button>
          )}
          {status === 'available' && (
            <Button variant="contained" onClick={() => void installUpdate()}>
              Update and restart
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  )
}

function UpdateReleaseNotes({
  status,
  update,
}: {
  status: Status
  update: Pick<Update, 'version' | 'body'> | null
}) {
  if (status !== 'available' || !update) return null
  return (
    <>
      <Typography variant="h6">Version {update.version}</Typography>
      {update.body && (
        <Typography
          variant="body2"
          sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
        >
          {update.body}
        </Typography>
      )}
      <Typography variant="body2">
        Your saved accounts, builds, wish history, and screenshots stay on this
        PC. Finish any imports or scans before updating.
      </Typography>
    </>
  )
}
