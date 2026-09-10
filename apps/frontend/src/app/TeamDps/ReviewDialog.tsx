import { CardThemed, ModalWrapper } from '@genshin-optimizer/common/ui'
import type { CharacterKey } from '@genshin-optimizer/gi/consts'
import type { TeamDpsContribution } from '@genshin-optimizer/gi/db'
import {
  CharacterSingleSelectionModal,
  CharIconSide,
} from '@genshin-optimizer/gi/ui'
import {
  Alert,
  Box,
  Button,
  CardContent,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import type { CharNameMap, ParsedScreenshot } from './parse'
import { TEAM_SIZE } from './parse'

export interface ReviewResult {
  characters: CharacterKey[]
  contributions: TeamDpsContribution[]
  dps: number
  totalDamage: number
  timeElapsedSec?: number
  strongestHit?: number
  uid?: string
  notes?: string
}

interface Row {
  character?: CharacterKey
  damage: string
}

function toNum(s: string): number | undefined {
  const cleaned = s.replace(/[\s,]/g, '')
  if (!cleaned) return undefined
  const n = Number(cleaned)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

export default function ReviewDialog({
  open,
  imageUrl,
  parsed,
  ocrErrorText,
  nameMap,
  onCancel,
  onSave,
}: {
  open: boolean
  imageUrl?: string
  parsed?: ParsedScreenshot
  ocrErrorText?: string
  nameMap: CharNameMap
  onCancel: () => void
  onSave: (result: ReviewResult) => void
}) {
  const [dps, setDps] = useState('')
  const [totalDamage, setTotalDamage] = useState('')
  const [timeElapsed, setTimeElapsed] = useState('')
  const [strongestHit, setStrongestHit] = useState('')
  const [uid, setUid] = useState('')
  const [notes, setNotes] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [pickerSlot, setPickerSlot] = useState<number | undefined>(undefined)

  useEffect(() => {
    if (!open) return
    setDps(parsed?.dps !== undefined ? String(parsed.dps) : '')
    setTotalDamage(
      parsed?.totalDamage !== undefined ? String(parsed.totalDamage) : ''
    )
    setTimeElapsed(
      parsed?.timeElapsedSec !== undefined ? String(parsed.timeElapsedSec) : ''
    )
    setStrongestHit(
      parsed?.strongestHit !== undefined ? String(parsed.strongestHit) : ''
    )
    setUid(parsed?.uid ?? '')
    setNotes('')
    const initial: Row[] = []
    for (let i = 0; i < TEAM_SIZE; i++) {
      const contribution = parsed?.contributions[i]
      initial.push({
        character: contribution?.character ?? parsed?.team[i],
        damage:
          contribution?.damage !== undefined ? String(contribution.damage) : '',
      })
    }
    setRows(initial)
  }, [open, parsed])

  const characters = rows
    .map((r) => r.character)
    .filter((c): c is CharacterKey => !!c)
  const distinct = new Set(characters).size === TEAM_SIZE
  const dpsNum = toNum(dps)
  const totalNum = toNum(totalDamage)
  const canSave = distinct && dpsNum !== undefined && dpsNum > 0

  const sumWarning = useMemo(() => {
    if (totalNum === undefined) return undefined
    const sum = rows.reduce((a, r) => a + (toNum(r.damage) ?? 0), 0)
    if (sum > 0 && Math.abs(sum - totalNum) > totalNum * 0.05)
      return 'Per-character damage does not add up to the total'
    return undefined
  }, [rows, totalNum])

  const save = () => {
    if (!canSave || dpsNum === undefined) return
    const contributions: TeamDpsContribution[] = rows
      .filter((r): r is Row & { character: CharacterKey } => !!r.character)
      .map((r) => ({ character: r.character, damage: toNum(r.damage) ?? 0 }))
    const time = Number.parseFloat(timeElapsed.replace(',', '.'))
    onSave({
      characters: [...new Set(characters)],
      contributions,
      dps: dpsNum,
      totalDamage: totalNum ?? 0,
      timeElapsedSec: Number.isFinite(time) && time > 0 ? time : undefined,
      strongestHit: toNum(strongestHit),
      uid: uid.trim() || undefined,
      notes: notes.trim() || undefined,
    })
  }

  return (
    <>
      <ModalWrapper open={open} onClose={onCancel}>
        <CardThemed>
          <CardContent
            sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}
          >
            <Typography variant="h5">Review screenshot results</Typography>
            {imageUrl && (
              <Box
                component="img"
                src={imageUrl}
                sx={{ width: '100%', maxHeight: 320, objectFit: 'contain' }}
              />
            )}
            {ocrErrorText && (
              <Alert severity="warning">
                OCR failed ({ocrErrorText}) - enter the values manually.
              </Alert>
            )}
            {parsed?.warnings.map((w) => (
              <Alert key={w} severity="info">
                {w}
              </Alert>
            ))}
            <Stack direction="row" spacing={1}>
              <TextField
                label="DPS"
                value={dps}
                onChange={(e) => setDps(e.target.value)}
                error={dpsNum === undefined || dpsNum <= 0}
                size="small"
              />
              <TextField
                label="Total Damage"
                value={totalDamage}
                onChange={(e) => setTotalDamage(e.target.value)}
                size="small"
              />
              <TextField
                label="Time (s)"
                value={timeElapsed}
                onChange={(e) => setTimeElapsed(e.target.value)}
                size="small"
              />
            </Stack>
            <Divider />
            {rows.map((row, i) => {
              const dmg = toNum(row.damage)
              const pct =
                dmg !== undefined && totalNum
                  ? Math.round((dmg / totalNum) * 100)
                  : undefined
              return (
                <Stack key={i} direction="row" spacing={1} alignItems="center">
                  <Button
                    onClick={() => setPickerSlot(i)}
                    startIcon={
                      row.character ? (
                        <CharIconSide characterKey={row.character} />
                      ) : undefined
                    }
                    variant="outlined"
                    sx={{ minWidth: 180, justifyContent: 'flex-start' }}
                  >
                    {row.character
                      ? (nameMap[row.character] ?? row.character)
                      : 'Select character'}
                  </Button>
                  <TextField
                    label="Damage"
                    value={row.damage}
                    onChange={(e) => {
                      const damage = e.target.value
                      setRows((rs) =>
                        rs.map((r, j) => (j === i ? { ...r, damage } : r))
                      )
                    }}
                    size="small"
                  />
                  <Typography sx={{ minWidth: 48 }} color="text.secondary">
                    {pct !== undefined ? `${pct}%` : ''}
                  </Typography>
                </Stack>
              )
            })}
            {!distinct && (
              <Alert severity="error">Pick 4 distinct characters.</Alert>
            )}
            {sumWarning && <Alert severity="warning">{sumWarning}</Alert>}
            <Stack direction="row" spacing={1}>
              <TextField
                label="Strongest Hit"
                value={strongestHit}
                onChange={(e) => setStrongestHit(e.target.value)}
                size="small"
              />
              <TextField
                label="UID"
                value={uid}
                onChange={(e) => setUid(e.target.value)}
                size="small"
              />
              <TextField
                label="Notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                size="small"
                fullWidth
              />
            </Stack>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button onClick={onCancel} color="secondary">
                Cancel
              </Button>
              <Button onClick={save} disabled={!canSave} variant="contained">
                Save run
              </Button>
            </Stack>
          </CardContent>
        </CardThemed>
      </ModalWrapper>
      <CharacterSingleSelectionModal
        show={pickerSlot !== undefined}
        onHide={() => setPickerSlot(undefined)}
        onSelect={(cKey) => {
          setRows((rs) =>
            rs.map((r, j) => (j === pickerSlot ? { ...r, character: cKey } : r))
          )
          setPickerSlot(undefined)
        }}
      />
    </>
  )
}
