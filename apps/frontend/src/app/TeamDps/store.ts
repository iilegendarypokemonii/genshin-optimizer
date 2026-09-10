import { isTauri } from '@genshin-optimizer/common/util'

export const SCREENSHOT_DIR = 'teamdps/screenshots'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Path of a screenshot relative to AppLocalData. Ids are our own
 * crypto.randomUUID() values; anything else (path separators, dots) is rejected
 * so a stored id can never escape the screenshot directory.
 */
export function screenshotRelPath(id: string): string {
  if (!UUID_RE.test(id)) throw new Error(`Invalid screenshot id: ${id}`)
  return `${SCREENSHOT_DIR}/${id}.png`
}

async function fsApi() {
  return await import('@tauri-apps/plugin-fs')
}

export async function saveScreenshot(
  id: string,
  bytes: Uint8Array
): Promise<void> {
  if (!isTauri()) return
  const rel = screenshotRelPath(id)
  const fs = await fsApi()
  const baseDir = fs.BaseDirectory.AppLocalData
  await fs.mkdir(SCREENSHOT_DIR, { baseDir, recursive: true })
  await fs.writeFile(rel, bytes, { baseDir })
}

/** Object URL for a stored screenshot, or undefined when missing/not desktop. Caller revokes. */
export async function loadScreenshotUrl(
  id: string
): Promise<string | undefined> {
  if (!isTauri()) return undefined
  try {
    const rel = screenshotRelPath(id)
    const fs = await fsApi()
    const baseDir = fs.BaseDirectory.AppLocalData
    if (!(await fs.exists(rel, { baseDir }))) return undefined
    const data = await fs.readFile(rel, { baseDir })
    const blob = new Blob([data], { type: 'image/png' })
    return URL.createObjectURL(blob)
  } catch {
    return undefined
  }
}

export async function deleteScreenshot(id: string): Promise<void> {
  if (!isTauri()) return
  try {
    const rel = screenshotRelPath(id)
    const fs = await fsApi()
    const baseDir = fs.BaseDirectory.AppLocalData
    if (await fs.exists(rel, { baseDir })) await fs.remove(rel, { baseDir })
  } catch {
    // best-effort cleanup; an orphaned file is harmless
  }
}

export async function revealScreenshot(id: string): Promise<void> {
  if (!isTauri()) return
  const { appLocalDataDir, join } = await import('@tauri-apps/api/path')
  const abs = await join(
    await appLocalDataDir(),
    ...SCREENSHOT_DIR.split('/'),
    `${id}.png`
  )
  const { revealItemInDir } = await import('@tauri-apps/plugin-opener')
  await revealItemInDir(abs)
}
