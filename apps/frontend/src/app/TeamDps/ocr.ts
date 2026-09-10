import { isTauri } from '@genshin-optimizer/common/util'
import { screenshotRelPath } from './store'
import type { OcrError, OcrOutput } from './types'

export function isOcrError(e: unknown): e is OcrError {
  return (
    typeof e === 'object' &&
    e !== null &&
    typeof (e as OcrError).kind === 'string' &&
    typeof (e as OcrError).message === 'string'
  )
}

/** Run Windows OCR over a screenshot previously saved with `saveScreenshot`. */
export async function ocrScreenshot(id: string): Promise<OcrOutput> {
  if (!isTauri())
    throw {
      kind: 'OcrUnavailable',
      message: 'OCR is only available in the desktop app',
    } satisfies OcrError
  const { invoke } = await import('@tauri-apps/api/core')
  return await invoke<OcrOutput>('ocr_screenshot', {
    relPath: screenshotRelPath(id),
  })
}
