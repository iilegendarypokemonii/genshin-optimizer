import CloseIcon from '@mui/icons-material/Close'
import OpenInBrowserIcon from '@mui/icons-material/OpenInBrowser'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { Button, IconButton, Toolbar, Typography } from '@mui/material'
import { isTauri } from '@genshin-optimizer/common/util'
import type { ToolEntry } from './toolsManifest'

export default function ToolViewer({
  tool,
  urlOverride,
  onClose,
}: {
  tool: ToolEntry | null
  urlOverride?: string | null
  onClose: () => void
}) {
  if (!tool) return null

  const activeUrl = urlOverride || tool.url

  const handleOpenInWindow = async () => {
    if (!isTauri()) return
    try {
      const { WebviewWindow } = await import(
        '@tauri-apps/api/webviewWindow'
      )

      // Check if window already exists — just focus it
      const existing = await WebviewWindow.getByLabel(`tool-${tool.id}`)
      if (existing) {
        await existing.setFocus()
        onClose()
        return
      }

      const webview = new WebviewWindow(`tool-${tool.id}`, {
        url: activeUrl,
        title: `${tool.name} - Genshin Optimizer`,
        width: 1280,
        height: 900,
        center: true,
        zoomHotkeysEnabled: true,
        browserExtensionsEnabled: false,
      })

      await new Promise<void>((resolve, reject) => {
        webview.once('tauri://created', () => resolve())
        webview.once('tauri://error', (e) => reject(e))
      })

      // Window opened — go back to tools grid
      onClose()
    } catch (err) {
      console.error('Failed to open Tauri window:', err)
    }
  }

  const handleOpenExternal = () => {
    window.open(activeUrl, '_blank', 'noopener,noreferrer')
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
        {isTauri() && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<OpenInBrowserIcon />}
            onClick={handleOpenInWindow}
            aria-label="Open in Window"
          >
            Open in Window
          </Button>
        )}
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
        src={activeUrl}
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
