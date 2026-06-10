const KEY = 'wishTracker:gameDir'

/** User-configured Genshin install folder; undefined = probe known locations. */
export function getGameDir(): string | undefined {
  return localStorage.getItem(KEY) || undefined
}

export function setGameDir(dir: string | undefined) {
  if (dir?.trim()) localStorage.setItem(KEY, dir.trim())
  else localStorage.removeItem(KEY)
}
