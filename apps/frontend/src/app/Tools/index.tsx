import { isTauri } from '@genshin-optimizer/common/util'
import ExtensionIcon from '@mui/icons-material/Extension'
import { Box, Grid, Typography } from '@mui/material'
import {
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import IrminsulPage from '../Irminsul'
import TeamDpsPage from '../TeamDps'
import { useDatabaseInfos } from '../WishTracker/useDatabaseInfos'
import ToolCard from './ToolCard'
import ToolViewer, { openToolWindow } from './ToolViewer'
import { toolsManifest } from './toolsManifest'

const internalPages: Record<string, () => JSX.Element> = {
  'game-data': IrminsulPage,
  'team-dps': TeamDpsPage,
}

export default function ToolsPage() {
  const { toolId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const dbInfos = useDatabaseInfos()

  if (toolId === 'irminsul' || toolId === 'wish-tracker') {
    const params = new URLSearchParams(searchParams)
    if (toolId === 'wish-tracker') params.set('tab', 'wishes')
    return (
      <Navigate
        replace
        to={{ pathname: '/tools/game-data', search: params.toString() }}
      />
    )
  }

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
    <Box data-testid="tools-page" sx={{ py: 1 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 1,
          mb: 1.5,
        }}
      >
        <ExtensionIcon />
        <Typography variant="h5">Tools</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
          Tools and resources for Genshin Impact
        </Typography>
      </Box>
      <Grid container spacing={1}>
        {toolsManifest.map((tool) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={tool.id}>
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
