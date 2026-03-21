import CloseIcon from '@mui/icons-material/Close'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { Box, IconButton, Toolbar, Typography } from '@mui/material'
import type { ToolEntry } from './toolsManifest'

export default function ToolViewer({
  tool,
  onClose,
}: {
  tool: ToolEntry | null
  onClose: () => void
}) {
  if (!tool) return null

  const handleOpenExternal = () => {
    window.open(tool.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      data-testid="tool-viewer"
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: 'calc(100vh - 128px)',
      }}
    >
      <Toolbar
        variant="dense"
        sx={{
          bgcolor: 'background.paper',
          borderRadius: 1,
          mb: 1,
          gap: 1,
        }}
      >
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          {tool.name}
        </Typography>
        <IconButton
          onClick={handleOpenExternal}
          size="small"
          aria-label="Open in Browser"
        >
          <OpenInNewIcon />
        </IconButton>
        <IconButton onClick={onClose} size="small" aria-label="Close">
          <CloseIcon />
        </IconButton>
      </Toolbar>
      <iframe
        data-testid="tool-iframe"
        src={tool.url}
        title={tool.name}
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        style={{
          flexGrow: 1,
          width: '100%',
          border: 'none',
          borderRadius: 4,
        }}
      />
    </div>
  )
}
