import { useDBMeta } from '@genshin-optimizer/gi/db-ui'
import CasinoIcon from '@mui/icons-material/Casino'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import FileUploadIcon from '@mui/icons-material/FileUpload'
import SettingsIcon from '@mui/icons-material/Settings'
import {
  Alert,
  Box,
  Button,
  Collapse,
  Grid,
  IconButton,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import { useMemo, useRef, useState } from 'react'
import BannerStatsCard from './BannerStatsCard'
import CacheStatusCard from './CacheStatusCard'
import HistoryTable from './HistoryTable'
import { useWishTracker } from './WishTrackerContext'
import { getGameDir, setGameDir } from './gameDirSetting'
import { exportBackup } from './storage'
import { bySlotLabel, slotLabel, useDatabaseInfos } from './useDatabaseInfos'

export default function WishTrackerPage() {
  const { isDesktop, profiles, error, importJson, setCapturingRadiance } =
    useWishTracker()
  const dbInfos = useDatabaseInfos()
  const activeDbMeta = useDBMeta()
  const [selectedUid, setSelectedUid] = useState<string | undefined>(undefined)
  const [notice, setNotice] = useState<
    { severity: 'success' | 'error'; text: string } | undefined
  >(undefined)
  const [showSettings, setShowSettings] = useState(false)
  const [gameDirDraft, setGameDirDraft] = useState(() => getGameDir() ?? '')
  const fileInput = useRef<HTMLInputElement>(null)

  // Tabs ordered by database-slot name (unnamed profiles last, by UID)
  const sortedProfiles = useMemo(
    () => profiles && [...profiles].sort(bySlotLabel(dbInfos)),
    [profiles, dbInfos]
  )

  const defaultUid = sortedProfiles?.some((p) => p.uid === activeDbMeta.uid)
    ? activeDbMeta.uid
    : sortedProfiles?.[0]?.uid
  const active = sortedProfiles?.find(
    (p) => p.uid === (selectedUid ?? defaultUid)
  )

  const characterEventStats = active?.stats.find((stats) => stats.key === '301')
  const chronicledStats = active?.stats.find((stats) => stats.key === '500')
  const secondaryStats = active?.stats
    .filter((stats) => stats.key !== '301' && stats.key !== '500')
    .sort(
      (a, b) =>
        ['302', '200', '100'].indexOf(a.key) -
        ['302', '200', '100'].indexOf(b.key)
    )

  async function onExportBackup() {
    try {
      const location = await exportBackup()
      setNotice({
        severity: 'success',
        text: `Backup of all profiles written to ${location}`,
      })
      if (isDesktop) {
        // best effort: show the file in Explorer
        const { revealItemInDir } = await import('@tauri-apps/plugin-opener')
        await revealItemInDir(location).catch(() => undefined)
      }
    } catch (e) {
      setNotice({
        severity: 'error',
        text: e instanceof Error ? e.message : String(e),
      })
    }
  }

  async function onImportFile(file: File) {
    try {
      const { uids, added } = await importJson(await file.text())
      setNotice({
        severity: 'success',
        text: `Imported ${added} new wishes into ${
          uids.length === 1 ? `profile ${uids[0]}` : `${uids.length} profiles`
        }.`,
      })
      setSelectedUid(uids[0])
    } catch (e) {
      setNotice({
        severity: 'error',
        text: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return (
    <Box sx={{ py: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <CasinoIcon fontSize="large" />
        <Typography variant="h4" sx={{ flexGrow: 1 }}>
          Wish Tracker
        </Typography>
        <Button
          variant="outlined"
          startIcon={<FileUploadIcon />}
          onClick={() => fileInput.current?.click()}
        >
          Import JSON
        </Button>
        <Button
          variant="outlined"
          startIcon={<FileDownloadIcon />}
          disabled={!profiles?.length}
          onClick={() => void onExportBackup()}
        >
          Export backup
        </Button>
        {isDesktop && (
          <IconButton
            onClick={() => setShowSettings((s) => !s)}
            title="Settings"
          >
            <SettingsIcon />
          </IconButton>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void onImportFile(file)
            e.target.value = ''
          }}
        />
      </Stack>

      <Collapse in={isDesktop && showSettings} unmountOnExit>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            size="small"
            fullWidth
            label="Genshin install folder (blank = auto-detect)"
            placeholder="e.g. C:\Program Files\Genshin Impact\Genshin Impact game"
            value={gameDirDraft}
            onChange={(e) => setGameDirDraft(e.target.value)}
          />
          <Button
            variant="contained"
            onClick={() => {
              setGameDir(gameDirDraft || undefined)
              setShowSettings(false)
            }}
          >
            Save
          </Button>
        </Stack>
      </Collapse>

      {notice && (
        <Alert severity={notice.severity} onClose={() => setNotice(undefined)}>
          {notice.text}
        </Alert>
      )}
      {error && <Alert severity="error">{error}</Alert>}

      <CacheStatusCard />

      {!profiles ? (
        <Skeleton variant="rectangular" height={300} />
      ) : !profiles.length ? (
        <Alert severity="info">
          No wish profiles yet.{' '}
          {isDesktop
            ? 'Open the wish history screen in-game and the tracker will pick it up (or click Sync wishes now), or import a wishes JSON export.'
            : 'Import a wishes JSON export to view it here.'}
        </Alert>
      ) : (
        <>
          {profiles.length > 1 && (
            <Tabs
              value={active?.uid ?? false}
              onChange={(_, uid: string) => setSelectedUid(uid)}
            >
              {sortedProfiles?.map((p) => {
                const label = slotLabel(dbInfos, p.uid)
                return (
                  <Tab
                    key={p.uid}
                    value={p.uid}
                    label={label ? `${label} (${p.uid})` : p.uid}
                  />
                )
              })}
            </Tabs>
          )}
          {active && (
            <>
              <Typography variant="body2" color="text.secondary">
                UID {active.uid} · {active.file.wishes.length.toLocaleString()}{' '}
                wishes · last export {active.file.exported || 'unknown'}
              </Typography>
              <Grid container spacing={2}>
                {(characterEventStats || chronicledStats) && (
                  <Grid item xs={12} md={6}>
                    <Stack spacing={2}>
                      {characterEventStats && (
                        <BannerStatsCard
                          key={`${active.uid}-${characterEventStats.key}`}
                          stats={characterEventStats}
                          onSetCapturingRadiance={(wishId, confirmed) =>
                            setCapturingRadiance(active.uid, wishId, confirmed)
                          }
                        />
                      )}
                      {chronicledStats && (
                        <BannerStatsCard
                          key={`${active.uid}-${chronicledStats.key}`}
                          stats={chronicledStats}
                        />
                      )}
                    </Stack>
                  </Grid>
                )}
                {!!secondaryStats?.length && (
                  <Grid item xs={12} md={6}>
                    <Stack spacing={2}>
                      {secondaryStats.map((stats) => (
                        <BannerStatsCard
                          stats={stats}
                          key={`${active.uid}-${stats.key}`}
                        />
                      ))}
                    </Stack>
                  </Grid>
                )}
              </Grid>
              <HistoryTable wishes={active.file.wishes} />
            </>
          )}
        </>
      )}
    </Box>
  )
}
