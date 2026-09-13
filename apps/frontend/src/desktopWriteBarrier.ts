// Installation exits the Windows process. Drain writes already in progress and
// hold new background writes until an unsuccessful installation is dismissed.
const pending = new Set<Promise<unknown>>()
let resume: (() => void) | undefined
let paused: Promise<void> | undefined

export async function desktopWrite<T>(write: () => Promise<T>): Promise<T> {
  while (paused) await paused
  const task = write()
  pending.add(task)
  try {
    return await task
  } finally {
    pending.delete(task)
  }
}

export function resumeDesktopWrites() {
  const release = resume
  paused = undefined
  resume = undefined
  release?.()
}

export async function pauseDesktopWrites() {
  if (paused) throw new Error('An update is already preparing to install.')
  paused = new Promise<void>((resolve) => {
    resume = resolve
  })
  try {
    await Promise.all(pending)
  } catch (error) {
    resumeDesktopWrites()
    throw error
  }
}
