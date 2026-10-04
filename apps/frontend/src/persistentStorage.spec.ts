import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fs = vi.hoisted(() => ({
  exists: vi.fn(),
  readTextFile: vi.fn(),
  mkdir: vi.fn(),
  writeTextFile: vi.fn(),
  rename: vi.fn(),
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
  it.each(['', '{"char'])(
    'preserves a damaged desktop save and keeps saving after recovery: %j',
    async (damaged) => {
      originalStorage.setItem('characters', '["Amber"]')
      fs.exists.mockResolvedValue(true)
      fs.readTextFile.mockResolvedValue(damaged)
      const { initializeDesktopStorage, flushDesktopStorage } = await import(
        './persistentStorage'
      )
      await initializeDesktopStorage()
      expect(fs.rename).toHaveBeenCalledWith(
        'storage/localStorage.json',
        expect.stringMatching(/localStorage\.json\.corrupt-\d+$/),
        { oldPathBaseDir: 28, newPathBaseDir: 28 }
      )
      expect(window.localStorage.getItem('characters')).toBe('["Amber"]')
      window.localStorage.setItem('new-edit', 'saved')
      await flushDesktopStorage()
      expect(fs.writeTextFile).toHaveBeenLastCalledWith(
        'storage/localStorage.json.tmp',
        JSON.stringify({ characters: '["Amber"]', 'new-edit': 'saved' }),
        { baseDir: 28 }
      )
    }
  )
  it('keeps disk saving active when the browser mirror has no quota', async () => {
    const fullMirror: Storage = {
      length: 0,
      key: () => null,
      getItem: () => null,
      clear: () => {},
      removeItem: () => {},
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError')
      },
    }
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: fullMirror,
    })
    fs.exists.mockResolvedValue(true)
    fs.readTextFile.mockResolvedValue('{"characters":"saved"}')
    const { initializeDesktopStorage, flushDesktopStorage } = await import(
      './persistentStorage'
    )
    await initializeDesktopStorage()
    expect(window.localStorage.getItem('characters')).toBe('saved')
    expect(() => window.localStorage.setItem('characters', 'new')).not.toThrow()
    await flushDesktopStorage()
    expect(fs.writeTextFile).toHaveBeenLastCalledWith(
      'storage/localStorage.json.tmp',
      '{"characters":"new"}',
      { baseDir: 28 }
    )
  })
  it('restores committed desktop data when the browser mirror is stale after a crash', async () => {
    originalStorage.setItem('characters', '[]')
    fs.exists.mockResolvedValue(true)
    fs.readTextFile.mockResolvedValue(
      JSON.stringify({ characters: '["Amber"]' })
    )
    const { initializeDesktopStorage, flushDesktopStorage } = await import(
      './persistentStorage'
    )
    await initializeDesktopStorage()
    expect(window.localStorage.getItem('characters')).toBe('["Amber"]')
    expect(originalStorage.getItem('characters')).toBe('["Amber"]')
    await flushDesktopStorage()
    expect(fs.writeTextFile).toHaveBeenLastCalledWith(
      'storage/localStorage.json.tmp',
      '{"characters":"[\\"Amber\\"]"}',
      { baseDir: 28 }
    )
  })
  it('migrates browser data when no desktop save exists', async () => {
    originalStorage.setItem('characters', '["Amber"]')
    fs.exists.mockResolvedValue(false)
    const { initializeDesktopStorage } = await import('./persistentStorage')
    await initializeDesktopStorage()
    expect(window.localStorage.getItem('characters')).toBe('["Amber"]')
  })
  it('writes the latest account edits immediately to the existing user-data location', async () => {
    const { initializeDesktopStorage, flushDesktopStorage } = await import(
      './persistentStorage'
    )
    await initializeDesktopStorage()
    window.localStorage.setItem('synthetic-account', 'new build')
    await flushDesktopStorage()
    expect(fs.writeTextFile).toHaveBeenLastCalledWith(
      'storage/localStorage.json.tmp',
      '{"synthetic-account":"new build"}',
      { baseDir: 28 }
    )
    expect(fs.rename).toHaveBeenLastCalledWith(
      'storage/localStorage.json.tmp',
      'storage/localStorage.json',
      { oldPathBaseDir: 28, newPathBaseDir: 28 }
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
