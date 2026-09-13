import { afterEach, describe, expect, it } from 'vitest'
import {
  desktopWrite,
  pauseDesktopWrites,
  resumeDesktopWrites,
} from './desktopWriteBarrier'

afterEach(resumeDesktopWrites)

describe('installation write barrier', () => {
  it('waits for an in-flight save and holds subsequent saves until resumed', async () => {
    let finish!: () => void
    let drained = false
    let newSave = false
    const saving = desktopWrite(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        })
    )
    const pause = pauseDesktopWrites().then(() => {
      drained = true
    })
    const later = desktopWrite(async () => {
      newSave = true
    })
    await Promise.resolve()
    expect(drained).toBe(false)
    finish()
    await Promise.all([saving, pause])
    expect(drained).toBe(true)
    expect(newSave).toBe(false)
    resumeDesktopWrites()
    await later
    expect(newSave).toBe(true)
  })

  it('rejects preparation on a save failure and resumes waiting writes', async () => {
    let fail!: (error: Error) => void
    const writing = desktopWrite(
      () =>
        new Promise<void>((_, reject) => {
          fail = reject
        })
    )
    const paused = pauseDesktopWrites()
    const later = desktopWrite(async () => 'resumed')
    const assertions = Promise.all([
      expect(writing).rejects.toThrow('disk full'),
      expect(paused).rejects.toThrow('disk full'),
    ])
    fail(new Error('disk full'))
    await assertions
    expect(await later).toBe('resumed')
  })
})
