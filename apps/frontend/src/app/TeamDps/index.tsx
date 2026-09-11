import { useDataManagerEntries } from '@genshin-optimizer/common/database-ui'
import { CardThemed } from '@genshin-optimizer/common/ui'
import { isTauri } from '@genshin-optimizer/common/util'
import type { CharacterKey } from '@genshin-optimizer/gi/consts'
import type { TeamDpsRun, TeamDpsSim } from '@genshin-optimizer/gi/db'
import { bestTeamDpsRun, latestTeamDpsRun } from '@genshin-optimizer/gi/db'
import { useDatabase, useDBMeta } from '@genshin-optimizer/gi/db-ui'
import { iconAsset, SillyContext } from '@genshin-optimizer/gi/ui'
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate'
import SpeedIcon from '@mui/icons-material/Speed'
import {
  Alert,
  Avatar,
  Box,
  Button,
  CardContent,
  Chip,
  CircularProgress,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material'
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import { getCharNameMap } from './nameMap'
import { ocrScreenshot } from './ocr'
import type { ParsedScreenshot } from './parse'
import { parseOcrLines } from './parse'
import type { ReviewResult } from './ReviewDialog'
import ReviewDialog from './ReviewDialog'
import { deleteScreenshot, saveScreenshot } from './store'
import TeamCard from './TeamCard'

interface Pending {
  id: string
  imageUrl: string
  parsed?: ParsedScreenshot
  ocrErrorText?: string
}

type SortKey = 'best' | 'recent' | 'total' | 'runs'

export default function TeamDpsPage() {
  // ensure the charNames_gen namespace is loaded before building the name map
  useTranslation('charNames_gen')
  const database = useDatabase()
  const { gender, uid: accountUid } = useDBMeta()
  const { silly } = useContext(SillyContext)
  const nameMap = useMemo(() => getCharNameMap(gender), [gender])
  const entries = useDataManagerEntries(database.teamDpsSims)
  const isDesktop = isTauri()

  const [sortKey, setSortKey] = useState<SortKey>('best')
  const [charFilter, setCharFilter] = useState<
    Partial<Record<CharacterKey, 'in' | 'out'>>
  >({})
  const [pending, setPending] = useState<Pending | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const fileInput = useRef<HTMLInputElement>(null)

  const sorted = useMemo(() => {
    const metric = (sim: TeamDpsSim): number => {
      switch (sortKey) {
        case 'recent':
          return latestTeamDpsRun(sim)?.date ?? 0
        case 'total':
          return bestTeamDpsRun(sim)?.totalDamage ?? 0
        case 'runs':
          return sim.runs.length
        default:
          return bestTeamDpsRun(sim)?.dps ?? 0
      }
    }
    return [...entries].sort(([, a], [, b]) => metric(b) - metric(a))
  }, [entries, sortKey])

  const teamCharacters = useMemo(() => {
    const set = new Set<CharacterKey>()
    for (const [, sim] of entries) for (const ck of sim.characters) set.add(ck)
    return [...set].sort((a, b) =>
      (nameMap[a] ?? a).localeCompare(nameMap[b] ?? b)
    )
  }, [entries, nameMap])

  const cycleFilter = useCallback((ck: CharacterKey) => {
    setCharFilter((f) => {
      const next = { ...f }
      if (f[ck] === 'in') next[ck] = 'out'
      else if (f[ck] === 'out') delete next[ck]
      else next[ck] = 'in'
      return next
    })
  }, [])

  const filtered = useMemo(
    () =>
      sorted.filter(([, sim]) =>
        Object.entries(charFilter).every(([ck, mode]) =>
          mode === 'in'
            ? sim.characters.includes(ck as CharacterKey)
            : !sim.characters.includes(ck as CharacterKey)
        )
      ),
    [sorted, charFilter]
  )

  const handleFiles = useCallback(
    async (files: ArrayLike<File>) => {
      if (busy || pending) return
      const file = Array.from(files).find((f) => f.type.startsWith('image/'))
      if (!file) return
      setBusy(true)
      setError(undefined)
      const id = crypto.randomUUID()
      const imageUrl = URL.createObjectURL(file)
      try {
        const bytes = new Uint8Array(await file.arrayBuffer())
        await saveScreenshot(id, bytes)
        try {
          const ocr = await ocrScreenshot(id)
          const parsed = parseOcrLines(ocr.lines, nameMap)
          setPending({ id, imageUrl, parsed })
        } catch (e) {
          const message =
            typeof e === 'object' && e && 'message' in e
              ? String((e as { message: unknown }).message)
              : String(e)
          setPending({ id, imageUrl, ocrErrorText: message })
        }
      } catch (e) {
        URL.revokeObjectURL(imageUrl)
        await deleteScreenshot(id)
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    },
    [busy, pending, nameMap]
  )

  // paste a screenshot (e.g. Win+Shift+S then Ctrl+V)
  useEffect(() => {
    if (!isDesktop) return undefined
    const onPaste = (e: ClipboardEvent) => {
      if (e.clipboardData?.files.length) void handleFiles(e.clipboardData.files)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [handleFiles, isDesktop])

  const closePending = useCallback(() => {
    if (!pending) return
    URL.revokeObjectURL(pending.imageUrl)
    setPending(undefined)
  }, [pending])

  const onCancel = useCallback(() => {
    if (!pending) return
    void deleteScreenshot(pending.id)
    closePending()
  }, [pending, closePending])

  const onSave = useCallback(
    (result: ReviewResult) => {
      if (!pending) return
      const run: TeamDpsRun = {
        id: pending.id,
        date: Date.now(),
        dps: result.dps,
        totalDamage: result.totalDamage,
        contributions: result.contributions,
        hasScreenshot: true,
        ...(result.timeElapsedSec !== undefined
          ? { timeElapsedSec: result.timeElapsedSec }
          : {}),
        ...(result.strongestHit !== undefined
          ? { strongestHit: result.strongestHit }
          : {}),
        ...(result.uid ? { uid: result.uid } : {}),
        ...(result.notes ? { notes: result.notes } : {}),
        ...(result.reactions ? { reactions: result.reactions } : {}),
      }
      const simId = database.teamDpsSims.addRun(result.characters, run)
      if (!simId) {
        setError('Could not save the run - check the entered values.')
        return
      }
      closePending()
    },
    [pending, database, closePending]
  )

  return (
    <Box
      data-testid="team-dps-page"
      sx={{ py: 2, display: 'flex', flexDirection: 'column', gap: 2 }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        if (isDesktop) void handleFiles(e.dataTransfer.files)
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1}>
        <SpeedIcon fontSize="large" />
        <Typography variant="h4">Team DPS</Typography>
        <Chip size="small" label={`${entries.length} teams`} />
        <Box sx={{ flexGrow: 1 }} />
        <Select
          size="small"
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
        >
          <MenuItem value="best">Best DPS</MenuItem>
          <MenuItem value="recent">Recent</MenuItem>
          <MenuItem value="total">Total Damage</MenuItem>
          <MenuItem value="runs">Run Count</MenuItem>
        </Select>
        {isDesktop && (
          <Button
            variant="contained"
            startIcon={
              busy ? <CircularProgress size={18} /> : <AddPhotoAlternateIcon />
            }
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            Add Screenshot
          </Button>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            if (e.target.files) void handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </Stack>
      {teamCharacters.length > 1 && (
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
        >
          <Typography variant="caption" color="text.secondary">
            Filter
          </Typography>
          {teamCharacters.map((ck) => {
            const mode = charFilter[ck]
            return (
              <Chip
                key={ck}
                clickable
                size="small"
                avatar={<Avatar src={iconAsset(ck, gender, silly)} />}
                label={nameMap[ck] ?? ck}
                color={
                  mode === 'in'
                    ? 'primary'
                    : mode === 'out'
                      ? 'error'
                      : 'default'
                }
                sx={
                  mode === 'out'
                    ? { textDecoration: 'line-through' }
                    : undefined
                }
                onClick={() => cycleFilter(ck)}
              />
            )
          })}
          {!!Object.keys(charFilter).length && (
            <Chip
              size="small"
              label="Clear"
              variant="outlined"
              onClick={() => setCharFilter({})}
            />
          )}
        </Stack>
      )}
      {!isDesktop && (
        <Alert severity="info">
          Screenshot upload and OCR are only available in the desktop app.
        </Alert>
      )}
      {error && (
        <Alert severity="error" onClose={() => setError(undefined)}>
          {error}
        </Alert>
      )}
      {!entries.length && (
        <CardThemed>
          <CardContent>
            <Typography color="text.secondary">
              No team simulations yet. Run the DPS dummy trounce in game,
              screenshot the results, and drop the screenshot here (or paste it
              with Ctrl+V) to start tracking your teams.
            </Typography>
          </CardContent>
        </CardThemed>
      )}
      <Stack spacing={1}>
        {filtered.map(([simId, sim]) => (
          <TeamCard key={simId} simId={simId} sim={sim} nameMap={nameMap} />
        ))}
      </Stack>
      <ReviewDialog
        open={!!pending}
        imageUrl={pending?.imageUrl}
        parsed={pending?.parsed}
        ocrErrorText={pending?.ocrErrorText}
        nameMap={nameMap}
        accountUid={accountUid || undefined}
        onCancel={onCancel}
        onSave={onSave}
      />
    </Box>
  )
}
