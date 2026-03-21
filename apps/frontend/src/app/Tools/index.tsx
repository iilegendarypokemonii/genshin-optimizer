import { useDataEntryBase } from '@genshin-optimizer/common/database-ui'
import { DatabaseContext } from '@genshin-optimizer/gi/db-ui'
import ExtensionIcon from '@mui/icons-material/Extension'
import { Box, Grid, Typography } from '@mui/material'
import { useContext, useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import ToolCard from './ToolCard'
import ToolViewer from './ToolViewer'
import type { DatabaseInfo } from './toolsManifest'
import { toolsManifest } from './toolsManifest'

function useDatabaseInfos(): DatabaseInfo[] {
  const { databases } = useContext(DatabaseContext)
  const meta0 = useDataEntryBase(databases[0]?.dbMeta)
  const meta1 = useDataEntryBase(databases[1]?.dbMeta)
  const meta2 = useDataEntryBase(databases[2]?.dbMeta)
  const meta3 = useDataEntryBase(databases[3]?.dbMeta)
  return useMemo(
    () =>
      [meta0, meta1, meta2, meta3]
        .filter(Boolean)
        .map((m) => ({ name: m.name, uid: m.uid ?? '' })),
    [meta0, meta1, meta2, meta3]
  )
}

export default function ToolsPage() {
  const { toolId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const dbInfos = useDatabaseInfos()

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
              extraLinks={tool.dynamicLinks?.(dbInfos)}
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
