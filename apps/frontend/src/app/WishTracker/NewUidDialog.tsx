import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material'
import { useWishTracker } from './WishTrackerContext'

/** Non-blocking prompt when the cache authkey belongs to a UID with no profile. */
export default function NewUidDialog() {
  const { pendingUid, approvePendingUid, dismissPendingUid } = useWishTracker()
  return (
    <Dialog open={!!pendingUid} onClose={dismissPendingUid}>
      <DialogTitle>New account found</DialogTitle>
      <DialogContent>
        <DialogContentText>
          The game cache holds a wish-history key for UID {pendingUid}, which
          has no profile yet. Create one and fetch its full wish history? This
          pages through every banner and can take a minute.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={dismissPendingUid}>Not now</Button>
        <Button variant="contained" onClick={() => void approvePendingUid()}>
          Create profile
        </Button>
      </DialogActions>
    </Dialog>
  )
}
