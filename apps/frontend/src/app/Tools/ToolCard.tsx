import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import {
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Typography,
} from '@mui/material'
import type { ToolEntry } from './toolsManifest'

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
  onOpen,
}: {
  tool: ToolEntry
  onOpen: (tool: ToolEntry) => void
}) {
  return (
    <Card
      data-testid={`tool-card-${tool.id}`}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.15s, box-shadow 0.15s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 6,
        },
      }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        <Typography variant="h6" gutterBottom>
          {tool.name}
        </Typography>
        <Chip
          label={tool.category}
          color={categoryColors[tool.category]}
          size="small"
          sx={{ mb: 1, textTransform: 'capitalize' }}
        />
        <Typography variant="body2" color="text.secondary">
          {tool.description}
        </Typography>
      </CardContent>
      <CardActions>
        <Button
          size="small"
          variant="contained"
          endIcon={<OpenInNewIcon />}
          onClick={() => onOpen(tool)}
        >
          Open
        </Button>
      </CardActions>
    </Card>
  )
}
