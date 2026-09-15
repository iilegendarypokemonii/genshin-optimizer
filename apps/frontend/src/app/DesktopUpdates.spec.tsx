import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DesktopUpdates from './DesktopUpdates'

const mocks = vi.hoisted(() => ({
  desktop: true,
  check: vi.fn(),
  download: vi.fn(),
  install: vi.fn(),
  close: vi.fn(),
  flush: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  relaunch: vi.fn(),
  nativeInvoke: vi.fn(),
}))
vi.mock('@genshin-optimizer/common/util', () => ({
  isTauri: () => mocks.desktop,
}))
vi.mock('@tauri-apps/api/app', () => ({ getVersion: async () => '0.2.0' }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.nativeInvoke }))
vi.mock('@tauri-apps/plugin-updater', () => ({ check: mocks.check }))
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: mocks.relaunch }))
vi.mock('../persistentStorage', () => ({ flushDesktopStorage: mocks.flush }))
vi.mock('../desktopWriteBarrier', () => ({
  pauseDesktopWrites: mocks.pause,
  resumeDesktopWrites: mocks.resume,
}))

beforeEach(() => {
  vi.resetAllMocks()
  mocks.desktop = true
  mocks.check.mockResolvedValue({
    version: '0.3.0',
    body: 'New characters and fixes.',
    download: mocks.download,
    install: mocks.install,
    close: mocks.close,
  })
  mocks.close.mockResolvedValue(undefined)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

async function showUpdate() {
  render(<DesktopUpdates />)
  fireEvent.click(screen.getByRole('button', { name: 'Check for updates' }))
  return await screen.findByRole('button', { name: 'Update and restart' })
}

describe('desktop updates', () => {
  it('does not call native APIs or show an update control in the browser', () => {
    mocks.desktop = false
    const { container } = render(<DesktopUpdates />)
    expect(container.textContent).toBe('')
    expect(mocks.check).not.toHaveBeenCalled()
    expect(mocks.nativeInvoke).not.toHaveBeenCalled()
  })

  it('reports the installed version when already current', async () => {
    mocks.check.mockResolvedValue(null)
    render(<DesktopUpdates />)
    fireEvent.click(screen.getByRole('button', { name: 'Check for updates' }))
    expect(
      await screen.findByText('You have the latest desktop release.')
    ).toBeTruthy()
    expect(screen.getByText('Installed desktop version: 0.2.0')).toBeTruthy()
    expect(mocks.download).not.toHaveBeenCalled()
  })

  it('offers an update without installing and releases it when deferred', async () => {
    await showUpdate()
    expect(mocks.download).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Later' }))
    await waitFor(() => expect(mocks.close).toHaveBeenCalledOnce())
  })

  it('allows retry after an offline check', async () => {
    mocks.check.mockRejectedValueOnce(new Error('offline'))
    render(<DesktopUpdates />)
    fireEvent.click(screen.getByRole('button', { name: 'Check for updates' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))
    expect(
      await screen.findByRole('button', { name: 'Update and restart' })
    ).toBeTruthy()
    expect(mocks.check).toHaveBeenCalledTimes(2)
  })

  it('drains writes and saves before installation, without overlapping downloads', async () => {
    const order: string[] = []
    let finishDownload!: () => void
    let finishCaptureStop!: () => void
    mocks.download.mockImplementation((onEvent) => {
      order.push('download')
      onEvent({ event: 'Started', data: { contentLength: 100 } })
      onEvent({ event: 'Progress', data: { chunkLength: 50 } })
      return new Promise<void>((resolve) => {
        finishDownload = resolve
      })
    })
    mocks.pause.mockImplementation(async () => {
      order.push('drain')
    })
    mocks.nativeInvoke.mockImplementation(() => {
      order.push('stop capture')
      return new Promise<void>((resolve) => {
        finishCaptureStop = resolve
      })
    })
    mocks.flush.mockImplementation(async () => {
      order.push('save')
    })
    mocks.install.mockImplementation(async () => {
      order.push('install')
    })
    mocks.relaunch.mockImplementation(async () => {
      order.push('restart')
    })
    const button = await showUpdate()
    fireEvent.click(button)
    fireEvent.click(button)
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(
      '50'
    )
    expect(
      screen.getByRole('button', { name: 'Close' }).hasAttribute('disabled')
    ).toBe(true)
    await act(async () => finishDownload())
    await waitFor(() =>
      expect(order).toEqual(['download', 'drain', 'stop capture'])
    )
    expect(mocks.install).not.toHaveBeenCalled()
    expect(mocks.flush).not.toHaveBeenCalled()
    expect(mocks.nativeInvoke).toHaveBeenCalledExactlyOnceWith(
      'irminsul_stop',
      undefined
    )
    await act(async () => finishCaptureStop())
    await waitFor(() =>
      expect(order).toEqual([
        'download',
        'drain',
        'stop capture',
        'save',
        'install',
        'restart',
      ])
    )
    expect(mocks.download).toHaveBeenCalledOnce()
  })

  it.each([
    'download',
    'nativeInvoke',
    'flush',
  ] as const)('does not install after a %s failure', async (stage) => {
    mocks[stage].mockRejectedValueOnce(new Error('verification or save failed'))
    fireEvent.click(await showUpdate())
    expect(
      await screen.findByRole('button', { name: 'Try again' })
    ).toBeTruthy()
    expect(mocks.install).not.toHaveBeenCalled()
    expect(mocks.relaunch).not.toHaveBeenCalled()
    expect(mocks.resume).toHaveBeenCalled()
  })
})
