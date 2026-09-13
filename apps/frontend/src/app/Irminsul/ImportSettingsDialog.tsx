import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import {
  defaultImportSettings,
  type FilterKey,
  filterFields,
  type ImportSettings,
  normalizeImportSettings,
} from './settings'
import { type DataSelection, dataCategories } from './types'

export function ImportSettingsDialog({
  settings,
  selection,
  working,
  error,
  close,
  save,
}: {
  settings: ImportSettings
  selection: DataSelection
  working: boolean
  error: string
  close: () => void
  save: (settings: ImportSettings, selection: DataSelection) => void
}) {
  const [draft, setDraft] = useState(settings)
  const [categories, setCategories] = useState(selection)
  return (
    <Dialog open onClose={working ? undefined : close} fullWidth maxWidth="sm">
      <DialogTitle>Import and export settings</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          <Typography variant="body2">
            These settings apply to every selected account. Captured snapshots
            keep the original data.
          </Typography>
          {dataCategories.map((category) => (
            <Stack key={category} spacing={1}>
              <FormControlLabel
                label={category[0].toUpperCase() + category.slice(1)}
                control={
                  <Checkbox
                    checked={categories[category]}
                    onChange={(_, checked) =>
                      setCategories((s) => ({ ...s, [category]: checked }))
                    }
                  />
                }
              />
              {category !== 'materials' && (
                <Box
                  sx={{
                    display: 'grid',
                    gap: 1,
                    gridTemplateColumns: {
                      xs: '1fr',
                      sm:
                        category === 'characters'
                          ? 'repeat(3, minmax(0, 1fr))'
                          : 'repeat(2, minmax(0, 1fr))',
                    },
                  }}
                >
                  {filterFields[category].map(
                    ([key, label, min, max]: readonly [
                      FilterKey,
                      string,
                      number,
                      number,
                    ]) => (
                      <TextField
                        key={key}
                        label={label}
                        type="number"
                        size="small"
                        fullWidth
                        disabled={!categories[category]}
                        value={draft[key]}
                        inputProps={{
                          min,
                          max,
                          step: 1,
                          'aria-label': `${category} ${label.toLowerCase()}`,
                        }}
                        onChange={(e) =>
                          setDraft((s) => ({
                            ...s,
                            [key]: Number(e.target.value),
                          }))
                        }
                      />
                    )
                  )}
                </Box>
              )}
            </Stack>
          ))}
          <FormControlLabel
            control={
              <Checkbox
                checked={draft.fakeLevelUp}
                onChange={(_, checked) =>
                  setDraft((s) => ({ ...s, fakeLevelUp: checked }))
                }
              />
            }
            label="Fake level-up for 5-star artifacts with an unactivated fourth stat"
          />
          <Alert severity={draft.fakeLevelUp ? 'warning' : 'info'}>
            Compatibility option for older tools. It simulates eligible
            artifacts at level 4 and activates their fourth stat in the import
            or export. This optimizer supports unactivated stats, so leave it
            off to keep actual levels. Minimum-level filtering uses the actual
            level.
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button
          disabled={working}
          onClick={() => setDraft({ ...defaultImportSettings })}
        >
          Reset filters
        </Button>
        <Button disabled={working} onClick={close}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={working}
          onClick={() => save(normalizeImportSettings(draft), categories)}
        >
          Save settings
        </Button>
      </DialogActions>
    </Dialog>
  )
}
