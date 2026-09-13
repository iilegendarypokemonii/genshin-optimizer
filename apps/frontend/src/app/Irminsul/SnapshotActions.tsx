import { Button, Stack } from '@mui/material'
export function SnapshotActions({
  uid,
  working,
  anySelected,
  canImport,
  exportData,
  previewImport,
  downloadBackup,
}: {
  uid: string
  working: boolean
  anySelected: boolean
  canImport: boolean
  exportData: () => void
  previewImport: () => void
  downloadBackup: () => void
}) {
  return (
    <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
      <Button
        variant="outlined"
        disabled={working || !anySelected}
        onClick={exportData}
      >
        Export selected data
      </Button>
      <Button
        variant="contained"
        disabled={working || !canImport}
        onClick={previewImport}
      >
        Preview optimizer import
      </Button>
      {localStorage.getItem(`irminsul_backup_${uid}`) && (
        <Button disabled={working} onClick={downloadBackup}>
          Download previous account backup
        </Button>
      )}
    </Stack>
  )
}
