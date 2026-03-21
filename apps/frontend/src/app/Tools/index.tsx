import ExtensionIcon from '@mui/icons-material/Extension'
import { Box, Grid, Typography } from '@mui/material'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import ToolCard from './ToolCard'
import ToolViewer from './ToolViewer'
import { toolsManifest } from './toolsManifest'

export default function ToolsPage() {
  const { toolId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const activeTool = toolId
    ? toolsManifest.find((t) => t.id === toolId) ?? null
    : null

  if (activeTool) {
    const urlOverride = searchParams.get('url')
    return (
      <ToolViewer
        tool={activeTool}
        urlOverride={urlOverride}
        onClose={() => navigate('/tools')}
      />
    )
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
              onOpen={(url) => {
                if (url === tool.url) {
                  navigate(`/tools/${tool.id}`)
                } else {
                  navigate(
                    `/tools/${tool.id}?url=${encodeURIComponent(url)}`
                  )
                }
              }}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}
