export type ToolEntry = {
  id: string
  name: string
  description: string
  url: string
  /** MUI icon name hint (actual rendering uses a generic icon) */
  icon: string
  category: 'database' | 'planner' | 'wiki' | 'community' | 'calculator'
}

export const toolsManifest: ToolEntry[] = [
  {
    id: 'enka-network',
    name: 'Enka.Network',
    description: 'Character showcase and profile viewer',
    url: 'https://enka.network/',
    icon: 'AccountBox', // profile/showcase
    category: 'database',
  },
  {
    id: 'paimon-moe',
    name: 'Paimon.moe',
    description: 'Wish tracker, timeline, and calculator',
    url: 'https://paimon.moe/',
    icon: 'Timeline', // timeline/planner
    category: 'planner',
  },
  {
    id: 'genshin-interactive-map',
    name: 'Genshin Interactive Map',
    description: 'Official interactive map from HoYoLAB',
    url: 'https://act.hoyolab.com/ys/app/interactive-map/',
    icon: 'Map', // map
    category: 'wiki',
  },
  {
    id: 'akasha-system',
    name: 'Akasha System',
    description: 'Leaderboards and build database',
    url: 'https://akasha.cv/',
    icon: 'Leaderboard', // leaderboards
    category: 'database',
  },
  {
    id: 'project-ambr',
    name: 'Project Ambr',
    description: 'Comprehensive game database browser',
    url: 'https://ambr.top/',
    icon: 'Storage', // database
    category: 'wiki',
  },
  {
    id: 'keqing-mains',
    name: 'Keqing Mains',
    description: 'Guides and theorycrafting community',
    url: 'https://keqingmains.com/',
    icon: 'School', // guides
    category: 'community',
  },
]
