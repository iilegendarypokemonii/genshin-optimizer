import ExtensionIcon from '@mui/icons-material/Extension'
import { Box, Grid, Typography } from '@mui/material'
import { useState } from 'react'
import ToolCard from './ToolCard'
import ToolViewer from './ToolViewer'
import type { ToolEntry } from './toolsManifest'
import { toolsManifest } from './toolsManifest'

export default function ToolsPage() {
  const [activeTool, setActiveTool] = useState<ToolEntry | null>(null)

  if (activeTool) {
    return <ToolViewer tool={activeTool} onClose={() => setActiveTool(null)} />
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
            <ToolCard tool={tool} onOpen={setActiveTool} />
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}
