import { isTauri } from '@genshin-optimizer/common/util'
import type { AccountSnapshot, CaptureState } from './types'

async function invoke<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(command, args)
}

export const capture = {
  status: () => invoke<CaptureState>('irminsul_status'),
  start: () => invoke<void>('irminsul_start'),
  stop: () => invoke<void>('irminsul_stop'),
  snapshot: (uid: string, captureId: string) =>
    invoke<AccountSnapshot>('irminsul_snapshot', { uid, captureId }),
}

export async function stopCaptureBeforeUpdate() {
  if (isTauri()) await capture.stop()
}
