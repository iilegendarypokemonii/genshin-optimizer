import CasinoIcon from '@mui/icons-material/Casino'
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
import { useRef, useState } from 'react'
import BannerStatsCard from './BannerStatsCard'
import CacheStatusCard from './CacheStatusCard'
import HistoryTable from './HistoryTable'
import { useWishTracker } from './WishTrackerContext'
import { getGameDir, setGameDir } from './gameDirSetting'
import { slotLabel, useDatabaseInfos } from './useDatabaseInfos'

export default function WishTrackerPage() {
  const { isDesktop, profiles, error, importJson } = useWishTracker()
  const dbInfos = useDatabaseInfos()
  const [selectedUid, setSelectedUid] = useState<string | undefined>(undefined)
  const [notice, setNotice] = useState<
    { severity: 'success' | 'error'; text: string } | undefined
  >(undefined)
  const [showSettings, setShowSettings] = useState(false)
  const [gameDirDraft, setGameDirDraft] = useState(() => getGameDir() ?? '')
  const fileInput = useRef<HTMLInputElement>(null)

  const active = profiles?.find((p) => p.uid === selectedUid) ?? profiles?.[0]

  async function onImportFile(file: File) {
    try {
      const { uid, added } = await importJson(await file.text())
      setNotice({
        severity: 'success',
        text: `Imported ${added} new wishes into profile ${uid}.`,
      })
      setSelectedUid(uid)
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
              {profiles.map((p) => {
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
                {active.stats.map((stats) => (
                  <Grid item xs={12} md={6} lg={4} key={stats.key}>
                    <BannerStatsCard stats={stats} />
                  </Grid>
                ))}
              </Grid>
              <HistoryTable wishes={active.file.wishes} />
            </>
          )}
        </>
      )}
    </Box>
  )
}
