import { isTauri } from '@genshin-optimizer/common/util'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import { capture } from './capture'
import { type CaptureMode, type CaptureState, idleState } from './types'

type CaptureContext = {
  state: CaptureState
  error: string
  busy: boolean
  mode: CaptureMode
  setMode: (mode: CaptureMode) => void
  start: () => Promise<void>
  stop: () => Promise<void>
}
const Context = createContext<CaptureContext | undefined>(undefined)

export function IrminsulProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(idleState)
  const [error, setError] = useState('')
  const [pollError, setPollError] = useState('')
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<CaptureMode>('auto')
  useEffect(() => {
    if (!isTauri()) return
    let active = true
    let timer: ReturnType<typeof setTimeout>
    async function poll() {
      try {
        const result = await capture.status()
        if (active) {
          setState(result)
          setPollError('')
        }
      } catch (cause) {
        if (active) setPollError(String(cause))
      } finally {
        if (active) timer = setTimeout(() => void poll(), 750)
      }
    }
    void poll()
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [])

  const run = useCallback(async (action: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try {
      await action()
      setState(await capture.status())
    } catch (cause) {
      setError(String(cause))
    } finally {
      setBusy(false)
    }
  }, [])
  const start = useCallback(() => run(() => capture.start(mode)), [run, mode])
  const stop = useCallback(() => run(capture.stop), [run])
  return (
    <Context.Provider
      value={{
        state,
        error: error || pollError,
        busy,
        mode,
        setMode,
        start,
        stop,
      }}
    >
      {children}
    </Context.Provider>
  )
}

export function useIrminsul() {
  const context = useContext(Context)
  if (!context) throw new Error('IrminsulProvider is missing')
  return context
}
