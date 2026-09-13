import { isTauri, saveTextFileWithDialog } from '@genshin-optimizer/common/util'
import { DatabaseContext } from '@genshin-optimizer/gi/db-ui'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
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
import { BatchAccountSelection } from './BatchAccountSelection'
import {
  applyBatchImport,
  type BatchEntry,
  type BatchResult,
  prepareBatchImport,
} from './batchImport'
import { CaptureControls, CaptureMessages } from './CaptureControls'
import { capture } from './capture'
import { BatchImportDialog, ImportDialog } from './ImportDialogs'
import { ImportSettingsDialog } from './ImportSettingsDialog'
import { useIrminsul } from './IrminsulContext'
import {
  applyImport,
  exportSelection,
  type ImportPreview,
  prepareImport,
} from './importSnapshot'
import { SnapshotActions } from './SnapshotActions'
import {
  type ImportSettings,
  readDataSelection,
  readImportSettings,
} from './settings'
import { dataCategories } from './types'

const standaloneUrl = 'https://github.com/iilegendarypokemonii/irminsul'

export default function IrminsulPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'wishes' ? 'wishes' : 'account'
  return (
    <Box sx={{ py: 2 }} data-testid="game-data-page">
      <Typography variant="h4">Game data</Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Account inventory and wish history for each account.
      </Typography>
      <Tabs
        value={tab}
        onChange={(_, value) =>
          setParams((current) => {
            const next = new URLSearchParams(current)
            if (value === 'wishes') next.set('tab', 'wishes')
            else next.delete('tab')
            return next
          })
        }
        aria-label="Game data tools"
      >
        <Tab
          id="account-data-tab"
          aria-controls="account-data-panel"
          value="account"
          label="Account data"
        />
        <Tab
          id="wishes-tab"
          aria-controls="wishes-panel"
          value="wishes"
          label="Wishes"
        />
      </Tabs>
      <Box
        sx={{ pt: 2 }}
        role="tabpanel"
        id="account-data-panel"
        aria-labelledby="account-data-tab"
        hidden={tab !== 'account'}
      >
        <AccountData />
      </Box>
      <Box
        sx={{ pt: 2 }}
        role="tabpanel"
        id="wishes-panel"
        aria-labelledby="wishes-tab"
        hidden={tab !== 'wishes'}
      >
        {tab === 'wishes' && <WishTrackerPage />}
      </Box>
    </Box>
  )
}

function AccountData() {
  const { state } = useIrminsul()
  const databaseContext = useContext(DatabaseContext)
  const currentContext = useRef(databaseContext)
  currentContext.current = databaseContext
  const dbInfos = useDatabaseInfos()
  const [selectedUid, setSelectedUid] = useState('')
  const [selection, setSelection] = useState(readDataSelection)
  const [settings, setSettings] = useState(readImportSettings)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [excludedUids, setExcludedUids] = useState<string[]>([])
  const [batch, setBatch] = useState<BatchEntry[]>()
  const [batchResults, setBatchResults] = useState<BatchResult[]>([])
  const selectedAccounts = state.snapshots.filter(
    (s) => !excludedUids.includes(s.uid)
  )
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
        JSON.stringify(exportSelection(snapshot, selection, settings), null, 2)
      )
      if (saved) setNotice(`Exported selected data for ${snapshot.uid}.`)
    })
  }

  async function previewImport() {
    const snapshot = await readSelected()
    setPreview(
      prepareImport(
        snapshot,
        selection,
        currentContext.current.databases,
        settings
      )
    )
  }

  async function saveSettings(
    next: ImportSettings,
    categories: typeof selection
  ) {
    await desktopWrite(async () => {
      localStorage.setItem('irminsul_import_settings', JSON.stringify(next))
      localStorage.setItem(
        'irminsul_data_selection',
        JSON.stringify(categories)
      )
      await flushDesktopStorage()
    })
    setSettings(next)
    setSelection(categories)
    setPreview(undefined)
    setBatch(undefined)
    setSettingsOpen(false)
  }

  async function previewBatch() {
    const snapshots = await Promise.all(
      selectedAccounts.map(async (summary) => {
        const snapshot = await capture.snapshot(summary.uid, summary.captureId)
        if (
          snapshot.uid !== summary.uid ||
          snapshot.captureId !== summary.captureId
        )
          throw new Error(
            `The snapshot for ${summary.uid} changed. Review it again.`
          )
        return snapshot
      })
    )
    setBatchResults([])
    setBatch(
      prepareBatchImport(
        snapshots,
        selection,
        currentContext.current.databases,
        settings
      )
    )
  }

  async function importBatch() {
    if (!batch) return
    await desktopWrite(async () => {
      const results = await applyBatchImport(
        batch,
        () => currentContext.current.databases,
        (index, database) =>
          currentContext.current.setDatabase(index, database),
        flushDesktopStorage
      )
      setBatchResults(results)
      setBatch(undefined)
      const completed = results.filter((r) => r.success).map((r) => r.uid)
      setExcludedUids((current) => [...new Set([...current, ...completed])])
    })
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
      <CaptureControls standaloneUrl={standaloneUrl} />
      <CaptureMessages error={error} notice={notice} />
      <Card>
        <CardContent>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mb: 2 }}
          >
            <Typography variant="h6">Account snapshots</Typography>
            <Button disabled={working} onClick={() => setSettingsOpen(true)}>
              Import settings
            </Button>
          </Stack>
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
                            void action(() =>
                              saveSettings(settings, {
                                ...selection,
                                [category]: checked,
                              })
                            )
                          }}
                        />
                      }
                      label={`${category[0].toUpperCase() + category.slice(1)} (${selected.counts[category]})`}
                    />
                  </Grid>
                ))}
              </Grid>
              <Typography variant="body2" color="text.secondary">
                Import settings filter the selected categories for every
                account. With the default settings, export includes all rarities
                at their actual levels. Optimizer import supports 3–5-star
                artifacts, regular characters, and weapons. Materials are
                available in the exported file.
              </Typography>
              <SnapshotActions
                uid={selected.uid}
                working={working}
                anySelected={anySelected}
                canImport={canImport}
                exportData={() => void action(exportData)}
                previewImport={() => void action(previewImport)}
                downloadBackup={() => void action(downloadBackup)}
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
      <BatchAccountSelection
        snapshots={state.snapshots}
        dbInfos={dbInfos}
        excludedUids={excludedUids}
        setExcludedUids={setExcludedUids}
        working={working}
        canImport={canImport}
        selectedCount={selectedAccounts.length}
        invalidate={() => setBatch(undefined)}
        review={() => void action(previewBatch)}
      />
      {batchResults.map((result) => (
        <Alert key={result.uid} severity={result.success ? 'success' : 'error'}>
          {slotLabel(dbInfos, result.uid) ?? 'Account'} · {result.uid}:{' '}
          {result.message}
        </Alert>
      ))}
      {settingsOpen && (
        <ImportSettingsDialog
          settings={settings}
          selection={selection}
          error={error}
          working={working}
          close={() => setSettingsOpen(false)}
          save={(next, categories) =>
            void action(() => saveSettings(next, categories))
          }
        />
      )}
      <BatchImportDialog
        batch={batch}
        working={working}
        error={error}
        close={() => setBatch(undefined)}
        confirm={() => void action(importBatch)}
      />
      <ImportDialog
        preview={preview}
        working={working}
        error={error}
        close={() => setPreview(undefined)}
        confirm={() => void action(importData)}
      />
    </Stack>
  )
}
