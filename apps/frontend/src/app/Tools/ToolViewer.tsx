import { isTauri } from '@genshin-optimizer/common/util'
import CloseIcon from '@mui/icons-material/Close'
import OpenInBrowserIcon from '@mui/icons-material/OpenInBrowser'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { Button, IconButton, Toolbar, Typography } from '@mui/material'
import type { ToolEntry } from './toolsManifest'

export async function openToolWindow(
  tool: ToolEntry,
  activeUrl: string
): Promise<boolean> {
  if (!isTauri()) return false

  try {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')

    const label = `tool-${tool.id}`
    const existing = await WebviewWindow.getByLabel(label)
    if (existing) {
      const { Window } = await import('@tauri-apps/api/window')
      await (await Window.getByLabel(label))?.setFocus()
      return true
    }

    const webview = new WebviewWindow(label, {
      url: activeUrl,
      title: `${tool.name} - Genshin Optimizer`,
      width: 1280,
      height: 900,
      center: true,
      zoomHotkeysEnabled: true,
      dataDirectory: tool.id,
    })

    await new Promise<void>((resolve, reject) => {
      webview.once('tauri://created', () => resolve())
      webview.once('tauri://error', (e) => reject(e))
    })
    return true
  } catch (err) {
    console.error('Failed to open Tauri window:', err)
    return false
  }
}

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
    if (await openToolWindow(tool, activeUrl)) onClose()
  }

  const handleOpenExternal = async () => {
    if (isTauri()) {
      try {
        const mod = await import(/* @vite-ignore */ '@tauri-apps/plugin-opener')
        await mod.openUrl(activeUrl)
        return
      } catch {
        // Plugin not available, fall through to window.open
      }
    }
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
