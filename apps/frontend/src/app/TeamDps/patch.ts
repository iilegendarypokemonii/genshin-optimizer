/**
 * Genshin ships a patch every 42 days. Anchored at 7.0 (2026-08-12).
 * Extend the anchor when 8.0 lands (new region arrives yearly).
 */
const PATCH_ANCHOR = { major: 7, minor: 0, startMs: Date.UTC(2026, 7, 12) }
const PATCH_MS = 42 * 24 * 60 * 60 * 1000

/** Game version at a given time, e.g. "7.0"; undefined before the anchor. */
export function patchForDate(ms: number): string | undefined {
  const idx = Math.floor((ms - PATCH_ANCHOR.startMs) / PATCH_MS)
  if (idx < 0) return undefined
  return `${PATCH_ANCHOR.major}.${PATCH_ANCHOR.minor + idx}`
}
