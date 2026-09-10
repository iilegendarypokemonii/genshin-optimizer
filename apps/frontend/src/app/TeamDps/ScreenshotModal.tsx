import { CardThemed, ModalWrapper } from '@genshin-optimizer/common/ui'
import { isTauri } from '@genshin-optimizer/common/util'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import { Box, Button, CardContent, Skeleton, Typography } from '@mui/material'
import { revealScreenshot } from './store'
import { useScreenshotUrl } from './useScreenshotUrl'

export default function ScreenshotModal({
  runId,
  show,
  onClose,
}: {
  runId: string | undefined
  show: boolean
  onClose: () => void
}) {
  const url = useScreenshotUrl(show ? runId : undefined)
  return (
    <ModalWrapper open={show} onClose={onClose}>
      <CardThemed>
        <CardContent
          sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: 1 }}
        >
          {url ? (
            <Box
              component="img"
              src={url}
              sx={{ width: '100%', borderRadius: 1 }}
            />
          ) : (
            <Skeleton variant="rectangular" sx={{ width: '100%', height: 400 }}>
              <Typography>Screenshot file not found on this machine</Typography>
            </Skeleton>
          )}
          {isTauri() && runId && (
            <Button
              size="small"
              startIcon={<FolderOpenIcon />}
              onClick={() => runId && revealScreenshot(runId)}
              sx={{ alignSelf: 'flex-start' }}
            >
              Reveal in Explorer
            </Button>
          )}
        </CardContent>
      </CardThemed>
    </ModalWrapper>
  )
}
