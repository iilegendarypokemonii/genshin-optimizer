export type ToolLink = {
  label: string
  url: string
}

export type DatabaseInfo = {
  name: string
  uid: string
}

export type ToolEntry = {
  id: string
  name: string
  description: string
  url: string
  links?: ToolLink[]
  /** Generate links dynamically from database state (e.g. UID-based profile links) */
  dynamicLinks?: (databases: DatabaseInfo[]) => ToolLink[]
  /** MUI icon name hint (actual rendering uses a generic icon) */
  icon: string
  category: 'database' | 'planner' | 'wiki' | 'community' | 'calculator'
  /** Renders a built-in React page at /tools/<id> instead of an external site */
  internal?: boolean
}

export const toolsManifest: ToolEntry[] = [
  {
    id: 'game-data',
    name: 'Game data',
    description:
      'Capture account inventory and manage wish history for each account',
    url: '',
    icon: 'Inventory2',
    category: 'database',
    internal: true,
  },
  {
    id: 'team-dps',
    name: 'Team DPS',
    description: 'Track DPS-dummy team damage from screenshots, per account',
    url: '',
    icon: 'Speed',
    category: 'planner',
    internal: true,
  },
  {
    id: 'wish-tracker',
    name: 'Wish Tracker',
    description:
      'Native pity dashboard and wish history, synced from the game cache',
    url: '',
    icon: 'Casino',
    category: 'planner',
    internal: true,
  },
  {
    id: 'enka-network',
    name: 'Enka.Network',
    description: 'Character showcase and profile viewer',
    url: 'https://enka.network/',
    dynamicLinks: (dbs) =>
      dbs
        .filter((db) => db.uid)
        .map((db) => ({
          label: db.name,
          url: `https://enka.network/u/${db.uid}`,
        })),
    icon: 'AccountBox',
    category: 'database',
  },
  {
    id: 'paimon-moe',
    name: 'Paimon.moe',
    description: 'Wish tracker, timeline, and calculator',
    url: 'https://paimon.moe/',
    icon: 'Timeline',
    category: 'planner',
  },
  {
    id: 'hu-tao-gacha-calculator',
    name: 'Hu Tao Gacha Calculator',
    description:
      'Pull probability calculator with pity, guarantees, constellations, and Capturing Radiance state',
    url: 'https://hutaobot.moe/tools/gachacalc',
    icon: 'Calculate',
    category: 'calculator',
  },
  {
    id: 'genshin-interactive-map',
    name: 'Genshin Interactive Map',
    description: 'Official interactive map from HoYoLAB',
    url: 'https://act.hoyolab.com/ys/app/interactive-map/',
    icon: 'Map',
    category: 'wiki',
  },
  {
    id: 'akasha-system',
    name: 'Akasha System',
    description: 'Leaderboards and build database',
    url: 'https://akasha.cv/',
    dynamicLinks: (dbs) =>
      dbs
        .filter((db) => db.uid)
        .map((db) => ({
          label: db.name,
          url: `https://akasha.cv/profile/${db.uid}`,
        })),
    icon: 'Leaderboard',
    category: 'database',
  },
  {
    id: 'stygian',
    name: 'Stygian.moe',
    description: 'Stygian Onslaught wiki and resources',
    url: 'https://www.stygian.moe/',
    icon: 'AutoAwesome',
    category: 'wiki',
  },
  {
    id: 'prydwen-tier-list',
    name: 'Prydwen Tier List',
    description: 'Genshin Impact character tier list and role rankings',
    url: 'https://www.prydwen.gg/genshin-impact/tier-list',
    icon: 'Leaderboard',
    category: 'wiki',
  },
  {
    id: 'keqing-mains',
    name: 'Keqing Mains',
    description: 'Guides and theorycrafting community',
    url: 'https://keqingmains.com/',
    icon: 'School',
    category: 'community',
  },
]
