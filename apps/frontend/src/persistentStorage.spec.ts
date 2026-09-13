import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fs = vi.hoisted(() => ({
  exists: vi.fn(),
  readTextFile: vi.fn(),
  mkdir: vi.fn(),
  writeTextFile: vi.fn(),
}))
vi.mock('@genshin-optimizer/common/util', () => ({ isTauri: () => true }))
vi.mock('@tauri-apps/plugin-fs', () => fs)
vi.mock('@tauri-apps/api/path', () => ({ BaseDirectory: { AppLocalData: 28 } }))
const originalStorage = window.localStorage

beforeEach(() => {
  vi.resetModules()
  vi.resetAllMocks()
  originalStorage.clear()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: originalStorage,
  })
})
afterEach(() => {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: originalStorage,
  })
})

describe('pre-update storage flush', () => {
  it('writes the latest account edits immediately to the existing user-data location', async () => {
    const { initializeDesktopStorage, flushDesktopStorage } = await import(
      './persistentStorage'
    )
    await initializeDesktopStorage()
    window.localStorage.setItem('synthetic-account', 'new build')
    await flushDesktopStorage()
    expect(fs.writeTextFile).toHaveBeenLastCalledWith(
      'storage/localStorage.json',
      '{"synthetic-account":"new build"}',
      { baseDir: 28 }
    )
  })
  it('reports failed saves instead of letting the updater silently exit', async () => {
    const { initializeDesktopStorage, flushDesktopStorage } = await import(
      './persistentStorage'
    )
    await initializeDesktopStorage()
    fs.writeTextFile.mockRejectedValue(new Error('disk full'))
    window.localStorage.setItem('synthetic-account', 'unsaved build')
    await expect(flushDesktopStorage()).rejects.toThrow('disk full')
  })
})
