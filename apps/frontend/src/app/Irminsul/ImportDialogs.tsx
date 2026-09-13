import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material'
import type { BatchEntry } from './batchImport'
import type { ImportPreview } from './importSnapshot'

export function ImportDialog({
  preview,
  working,
  error,
  close,
  confirm,
}: {
  preview?: ImportPreview
  working: boolean
  error: string
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
        {error && <Alert severity="error">{error}</Alert>}
        {preview && <ImportSummary preview={preview} />}
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

function ImportSummary({ preview }: { preview: ImportPreview }) {
  return (
    <Stack spacing={2}>
      <Typography>
        Destination: {preview.target.dbMeta.get().name} · UID{' '}
        {preview.snapshot.uid}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Login snapshot:{' '}
        {new Date(preview.snapshot.capturedAtMs).toLocaleString()}
      </Typography>
      {Object.entries(preview.filteredCounts).some(
        ([, count]) => count > 0
      ) && (
        <Alert severity="info">
          Excluded by your settings:{' '}
          {Object.entries(preview.filteredCounts)
            .filter(([, count]) => count > 0)
            .map(([category, count]) => `${count} ${category}`)
            .join(', ')}
          . The original snapshot is unchanged.
        </Alert>
      )}
      {preview.settings.fakeLevelUp && (
        <Alert severity="warning">
          Compatibility simulation is enabled: eligible artifacts are imported
          at level 4 with their fourth stat activated. The original capture is
          unchanged.
        </Alert>
      )}
      {!!preview.skippedArtifacts && (
        <Alert severity="warning">
          Excluded from this import: {preview.skippedArtifacts} artifacts with 1
          or 2 stars. The optimizer supports 3–5-star artifacts. The original
          capture keeps all rarities and actual levels; export follows your
          settings.
        </Alert>
      )}
      {!!preview.skippedCharacters.length && (
        <Alert severity="warning">
          Excluded from this import: {preview.skippedCharacters.join(', ')}.
          Miliastra Wonderland avatars are not supported by the optimizer. Their
          data remains in the capture export.
        </Alert>
      )}
      {!!(
        preview.unequippedItems.artifacts + preview.unequippedItems.weapons
      ) && (
        <Alert severity="warning">
          Equipment assigned to Miliastra Wonderland avatars will be imported as
          unequipped: {preview.unequippedItems.artifacts} artifacts,{' '}
          {preview.unequippedItems.weapons} weapons. The capture export keeps
          the original assignments.
        </Alert>
      )}
      {!!(
        preview.unequippedBySettings.artifacts +
        preview.unequippedBySettings.weapons
      ) && (
        <Alert severity="warning">
          Equipment for characters excluded by your settings and absent from
          this destination will be imported unequipped:{' '}
          {preview.unequippedBySettings.artifacts} artifacts,{' '}
          {preview.unequippedBySettings.weapons} weapons. The capture export
          keeps the original assignments.
        </Alert>
      )}
      {(['artifacts', 'characters', 'weapons'] as const)
        .filter((k) => preview.selection[k])
        .map((category) => {
          const result = preview.result[category]
          return (
            <Typography key={category}>
              {category}: {result.import} selected from capture;{' '}
              {preview.addedCounts[category]} added to account
            </Typography>
          )
        })}
      <Alert severity="info">
        Existing items absent from this scan are kept. Your previous account
        data will be backed up before applying the import. New characters
        receive optimizer defaults for equipment excluded from the import.
      </Alert>
    </Stack>
  )
}

export function BatchImportDialog({
  batch,
  working,
  error,
  close,
  confirm,
}: {
  batch?: BatchEntry[]
  working: boolean
  error: string
  close: () => void
  confirm: () => void
}) {
  return (
    <Dialog
      open={!!batch}
      onClose={working ? undefined : close}
      fullWidth
      maxWidth="md"
    >
      <DialogTitle>Review {batch?.length ?? 0} account imports</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error">{error}</Alert>}
        <Stack spacing={3}>
          {batch?.map((entry) => (
            <Box key={entry.uid}>
              {entry.preview ? (
                <ImportSummary preview={entry.preview} />
              ) : (
                <Alert severity="error">
                  UID {entry.uid}: {entry.error}
                </Alert>
              )}
            </Box>
          ))}
          <Alert severity="info">
            Each account is saved separately with a backup. If saving an account
            fails, that account is restored and the remaining imports stop;
            completed accounts stay imported.
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button disabled={working} onClick={close}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={
            working || !batch?.length || batch.some((entry) => !entry.preview)
          }
          onClick={confirm}
        >
          Import {batch?.length ?? 0} accounts
        </Button>
      </DialogActions>
    </Dialog>
  )
}
