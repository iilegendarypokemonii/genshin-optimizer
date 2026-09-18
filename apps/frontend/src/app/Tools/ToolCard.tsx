import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import {
  Box,
  Button,
  Card,
  Chip,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material'
import type { ToolEntry, ToolLink } from './toolsManifest'

const categoryColors: Record<
  ToolEntry['category'],
  'primary' | 'secondary' | 'success' | 'warning' | 'info'
> = {
  database: 'primary',
  planner: 'secondary',
  wiki: 'info',
  community: 'success',
  calculator: 'warning',
}

export default function ToolCard({
  tool,
  extraLinks,
  onOpenInApp,
  onOpenInWindow,
}: {
  tool: ToolEntry
  extraLinks?: ToolLink[]
  onOpenInApp: (url: string) => void
  onOpenInWindow: (url: string) => void
}) {
  const allLinks = [...(tool.links ?? []), ...(extraLinks ?? [])]

  return (
    <Card
      data-testid={`tool-card-${tool.id}`}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        p: 1.5,
        gap: 1,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography
          variant="h6"
          sx={{ flex: 1, minWidth: 0, fontSize: '1rem', lineHeight: 1.3 }}
        >
          {tool.name}
        </Typography>
        <Chip
          label={tool.category}
          color={categoryColors[tool.category]}
          size="small"
          sx={{
            height: 20,
            fontSize: '0.6875rem',
            textTransform: 'capitalize',
          }}
        />
      </Box>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ flexGrow: 1, fontSize: '0.8125rem' }}
      >
        {tool.description}
      </Typography>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          flexWrap: 'wrap',
          '& .MuiButton-root': { minWidth: 0, px: 0.75, fontSize: '0.75rem' },
        }}
      >
        <Button
          size="small"
          variant="contained"
          aria-label={
            tool.embeddable === false
              ? `Open ${tool.name} website`
              : `Open ${tool.name} in app`
          }
          onClick={() =>
            tool.embeddable === false
              ? onOpenInWindow(tool.url)
              : onOpenInApp(tool.url)
          }
        >
          {tool.embeddable === false ? 'Open website' : 'Open'}
        </Button>
        {!tool.internal && tool.embeddable !== false && (
          <Tooltip title="Open in a new window">
            <IconButton
              size="small"
              aria-label={`Open ${tool.name} in a new window`}
              onClick={() => onOpenInWindow(tool.url)}
            >
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {allLinks.map((link) => (
          <Button
            key={link.label}
            size="small"
            variant="text"
            aria-label={`Open ${tool.name} for ${link.label}`}
            sx={{ maxWidth: '100%', overflowWrap: 'anywhere' }}
            onClick={() => onOpenInApp(link.url)}
          >
            {link.label}
          </Button>
        ))}
      </Box>
    </Card>
  )
}
