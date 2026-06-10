import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material'
import { useWishTracker } from './WishTrackerContext'
import { slotLabel, useDatabaseInfos } from './useDatabaseInfos'

/** Non-blocking prompt when the cache authkey belongs to a UID with no wish profile. */
export default function NewUidDialog() {
  const { pendingUid, approvePendingUid, dismissPendingUid } = useWishTracker()
  const dbInfos = useDatabaseInfos()
  const label = pendingUid ? slotLabel(dbInfos, pendingUid) : undefined
  const account = label ? `${label} (UID ${pendingUid})` : `UID ${pendingUid}`
  return (
    <Dialog open={!!pendingUid} onClose={dismissPendingUid}>
      <DialogTitle>Start tracking wishes for {account}?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          The game cache holds a wish-history key for {account}, but the Wish
          Tracker has no stored wish history for it yet. Wish histories are
          stored separately from your account databases — this won't change your
          databases or anything else.
        </DialogContentText>
        <DialogContentText sx={{ mt: 1.5 }}>
          <strong>Fetch history</strong> pages through every banner via the
          official API (can take a minute, reaches back 365 days). If you have
          an older JSON export for this account, import that instead — or in
          addition; they merge safely.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={dismissPendingUid}>Not now</Button>
        <Button variant="contained" onClick={() => void approvePendingUid()}>
          Fetch history
        </Button>
      </DialogActions>
    </Dialog>
  )
}
