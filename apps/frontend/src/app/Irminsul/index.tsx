import { isTauri, saveTextFileWithDialog } from '@genshin-optimizer/common/util'
import { DatabaseContext } from '@genshin-optimizer/gi/db-ui'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import { useContext, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { desktopWrite } from '../../desktopWriteBarrier'
import { flushDesktopStorage } from '../../persistentStorage'
import WishTrackerPage from '../WishTracker'
import { slotLabel, useDatabaseInfos } from '../WishTracker/useDatabaseInfos'
import { capture } from './capture'
import { useIrminsul } from './IrminsulContext'
import {
  applyImport,
  exportSelection,
  type ImportPreview,
  prepareImport,
} from './importSnapshot'
import { type AccountSnapshot, dataCategories, defaultSelection } from './types'

const standaloneUrl = 'https://github.com/iilegendarypokemonii/irminsul'

export default function IrminsulPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'wishes' ? 'wishes' : 'account'
  return (
    <Box sx={{ py: 2 }} data-testid="irminsul-page">
      <Typography variant="h4">Irminsul</Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Capture and export game data for each account.
      </Typography>
      <Tabs
        value={tab}
        onChange={(_, value) =>
          setParams(value === 'wishes' ? { tab: value } : {})
        }
        aria-label="Game data tools"
      >
        <Tab value="account" label="Account data" />
        <Tab value="wishes" label="Wishes" />
      </Tabs>
      <Box sx={{ pt: 2 }}>
        {tab === 'account' ? <AccountData /> : <WishTrackerPage />}
      </Box>
    </Box>
  )
}

function AccountData() {
  const { state, busy, error: captureError, start, stop } = useIrminsul()
  const databaseContext = useContext(DatabaseContext)
  const currentContext = useRef(databaseContext)
  currentContext.current = databaseContext
  const dbInfos = useDatabaseInfos()
  const [selectedUid, setSelectedUid] = useState('')
  const [selection, setSelection] = useState(defaultSelection)
  const [preview, setPreview] = useState<ImportPreview>()
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const selected =
    state.snapshots.find((s) => s.uid === selectedUid) ?? state.snapshots[0]
  const anySelected = Object.values(selection).some(Boolean)
  const canImport =
    selection.artifacts || selection.characters || selection.weapons

  async function readSelected() {
    if (!selected) throw new Error('Select a completed account snapshot.')
    const snapshot = await capture.snapshot(selected.uid, selected.captureId)
    if (
      snapshot.uid !== selected.uid ||
      snapshot.captureId !== selected.captureId
    )
      throw new Error('The selected snapshot changed. Select it again.')
    return snapshot
  }

  async function action(work: () => Promise<void>) {
    setWorking(true)
    setError('')
    setNotice('')
    try {
      await work()
    } catch (cause) {
      setError(String(cause))
    } finally {
      setWorking(false)
    }
  }

  async function exportData() {
    const snapshot = await readSelected()
    await desktopWrite(async () => {
      const saved = await saveTextFileWithDialog(
        `irminsul_${snapshot.uid}_${snapshot.capturedAtMs}.json`,
        JSON.stringify(exportSelection(snapshot, selection), null, 2)
      )
      if (saved) setNotice(`Exported selected data for ${snapshot.uid}.`)
    })
  }

  async function previewImport() {
    const snapshot = await readSelected()
    setPreview(
      prepareImport(snapshot, selection, currentContext.current.databases)
    )
  }

  async function importData() {
    if (!preview) return
    await desktopWrite(async () => {
      await applyImport(
        preview,
        () => currentContext.current.databases,
        (index, database) =>
          currentContext.current.setDatabase(index, database),
        flushDesktopStorage
      )
      setPreview(undefined)
      setNotice(
        `Imported selected data into ${preview.snapshot.uid}. A backup of the previous account data was saved.`
      )
    })
  }

  async function downloadBackup() {
    if (!selected) return
    const backup = localStorage.getItem(`irminsul_backup_${selected.uid}`)
    if (!backup)
      throw new Error(
        'No previous import backup is available for this account.'
      )
    await desktopWrite(() =>
      saveTextFileWithDialog(
        `optimizer_before_irminsul_${selected.uid}.json`,
        backup
      )
    )
  }

  if (!isTauri())
    return (
      <Card>
        <CardContent>
          <Typography variant="h6">
            Available in the Windows desktop app
          </Typography>
          <Typography sx={{ my: 1 }}>
            Use the standalone Irminsul application to capture account data
            without installing the optimizer.
          </Typography>
          <Button
            component="a"
            href={standaloneUrl}
            target="_blank"
            rel="noreferrer"
          >
            Get standalone Irminsul
          </Button>
        </CardContent>
      </Card>
    )

  return (
    <Stack spacing={2}>
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
            Each login creates a snapshot for its captured UID. Wishes use the
            separate wish-history authkey; account-data capture does not need
            it.
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
      {(error || captureError || state.phase === 'error') && (
        <Alert severity="error">{error || captureError || state.message}</Alert>
      )}
      {notice && <Alert severity="success">{notice}</Alert>}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Account snapshots
          </Typography>
          {!selected ? (
            <Typography color="text.secondary">
              Completed scans will appear here, separately for each account.
            </Typography>
          ) : (
            <>
              <TextField
                select
                fullWidth
                label="Captured account"
                value={selected.uid}
                disabled={working}
                onChange={(e) => {
                  setSelectedUid(e.target.value)
                  setPreview(undefined)
                }}
              >
                {state.snapshots.map((snapshot) => (
                  <MenuItem key={snapshot.uid} value={snapshot.uid}>
                    {slotLabel(dbInfos, snapshot.uid) ?? 'Account'} ·{' '}
                    {snapshot.uid}
                  </MenuItem>
                ))}
              </TextField>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Captured {new Date(selected.capturedAtMs).toLocaleString()}.
                This is inventory at login; scan again after farming or
                upgrading.
              </Typography>
              <Grid container spacing={1} sx={{ my: 1 }}>
                {dataCategories.map((category) => (
                  <Grid item xs={6} sm={3} key={category}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={selection[category]}
                          disabled={working}
                          onChange={(_, checked) => {
                            setSelection((s) => ({
                              ...s,
                              [category]: checked,
                            }))
                            setPreview(undefined)
                          }}
                        />
                      }
                      label={`${category[0].toUpperCase() + category.slice(1)} (${selected.counts[category]})`}
                    />
                  </Grid>
                ))}
              </Grid>
              <Typography variant="body2" color="text.secondary">
                All rarities are included at their actual levels. Materials are
                available in the exported file; the optimizer imports artifacts,
                characters, and weapons.
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                <Button
                  variant="outlined"
                  disabled={working || !anySelected}
                  onClick={() => void action(exportData)}
                >
                  Export selected data
                </Button>
                <Button
                  variant="contained"
                  disabled={working || !canImport}
                  onClick={() => void action(previewImport)}
                >
                  Preview optimizer import
                </Button>
                {localStorage.getItem(`irminsul_backup_${selected.uid}`) && (
                  <Button
                    disabled={working}
                    onClick={() => void action(downloadBackup)}
                  >
                    Download previous account backup
                  </Button>
                )}
              </Stack>
              <SnapshotDetails
                snapshot={selected}
                readSelected={readSelected}
              />
              {selected.warnings?.map((warning) => (
                <Alert severity="warning" key={warning}>
                  {warning}
                </Alert>
              ))}
            </>
          )}
        </CardContent>
      </Card>
      <ImportDialog
        preview={preview}
        working={working}
        close={() => setPreview(undefined)}
        confirm={() => void action(importData)}
      />
    </Stack>
  )
}

function SnapshotDetails({
  snapshot,
  readSelected,
}: {
  snapshot: { uid: string; captureId: string }
  readSelected: () => Promise<AccountSnapshot>
}) {
  const [details, setDetails] = useState<AccountSnapshot>()
  const [error, setError] = useState('')
  const current =
    details?.uid === snapshot.uid && details.captureId === snapshot.captureId
      ? details
      : undefined
  return (
    <Box sx={{ mt: 2 }}>
      <Button
        size="small"
        onClick={() => {
          setError('')
          void readSelected()
            .then(setDetails)
            .catch((e) => setError(String(e)))
        }}
      >
        View materials
      </Button>
      {error && <Alert severity="error">{error}</Alert>}
      {current && (
        <Box sx={{ maxHeight: 240, overflow: 'auto', mt: 1 }}>
          {Object.entries(current.good.materials)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, count]) => (
              <Typography variant="body2" key={key}>
                {key.replace(/([a-z])([A-Z])/g, '$1 $2')}: {count}
              </Typography>
            ))}
        </Box>
      )}
    </Box>
  )
}

function ImportDialog({
  preview,
  working,
  close,
  confirm,
}: {
  preview?: ImportPreview
  working: boolean
  close: () => void
  confirm: () => void
}) {
  return (
    <Dialog
      open={!!preview}
      onClose={working ? undefined : close}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>Review account import</DialogTitle>
      <DialogContent>
        {preview && (
          <Stack spacing={2}>
            <Typography>
              Destination: {preview.target.dbMeta.get().name} · UID{' '}
              {preview.snapshot.uid}
            </Typography>
            {(['artifacts', 'characters', 'weapons'] as const)
              .filter((k) => preview.selection[k])
              .map((category) => {
                const result = preview.result[category]
                return (
                  <Typography key={category}>
                    {category}: {result.new.length} new, {result.update.length}{' '}
                    updated
                  </Typography>
                )
              })}
            <Alert severity="info">
              Existing items absent from this scan are kept. Your previous
              account data will be backed up before applying the import.
            </Alert>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button disabled={working} onClick={close}>
          Cancel
        </Button>
        <Button variant="contained" disabled={working} onClick={confirm}>
          Import into this account
        </Button>
      </DialogActions>
    </Dialog>
  )
}
