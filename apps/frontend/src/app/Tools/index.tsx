import ExtensionIcon from '@mui/icons-material/Extension'
import { Box, Grid, Typography } from '@mui/material'
import { isTauri } from '@genshin-optimizer/common/util'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import WishTrackerPage from '../WishTracker'
import { useDatabaseInfos } from '../WishTracker/useDatabaseInfos'
import ToolCard from './ToolCard'
import ToolViewer, { openToolWindow } from './ToolViewer'
import { toolsManifest } from './toolsManifest'

const internalPages: Record<string, () => JSX.Element> = {
  'wish-tracker': WishTrackerPage,
}

export default function ToolsPage() {
  const { toolId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const dbInfos = useDatabaseInfos()

  const activeTool = toolId
    ? (toolsManifest.find((t) => t.id === toolId) ?? null)
    : null

  if (activeTool) {
    if (activeTool.internal) {
      const InternalPage = internalPages[activeTool.id]
      if (InternalPage) return <InternalPage />
    } else {
      const urlOverride = searchParams.get('url')
      return (
        <ToolViewer
          tool={activeTool}
          urlOverride={urlOverride}
          onClose={() => navigate('/tools')}
        />
      )
    }
  }

  return (
    <Box data-testid="tools-page" sx={{ py: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <ExtensionIcon fontSize="large" />
        <Typography variant="h4">Tools</Typography>
      </Box>
      <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
        External tools and resources for Genshin Impact
      </Typography>
      <Grid container spacing={2}>
        {toolsManifest.map((tool) => (
          <Grid item xs={12} sm={6} md={4} key={tool.id}>
            <ToolCard
              tool={tool}
              extraLinks={tool.dynamicLinks?.(dbInfos)}
              onOpenInApp={(url) => {
                const route =
                  url === tool.url
                    ? `/tools/${tool.id}`
                    : `/tools/${tool.id}?url=${encodeURIComponent(url)}`
                navigate(route)
              }}
              onOpenInWindow={(url) => {
                if (isTauri()) {
                  void openToolWindow(tool, url).then((opened) => {
                    if (!opened)
                      window.open(url, '_blank', 'noopener,noreferrer')
                  })
                  return
                }
                window.open(url, '_blank', 'noopener,noreferrer')
              }}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}
