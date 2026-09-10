import { useEffect, useState } from 'react'
import { loadScreenshotUrl } from './store'

/** Object URL for a stored screenshot; revoked automatically on unmount/change. */
export function useScreenshotUrl(id: string | undefined) {
  const [url, setUrl] = useState<string | undefined>(undefined)
  useEffect(() => {
    if (!id) {
      setUrl(undefined)
      return undefined
    }
    let alive = true
    let objectUrl: string | undefined
    loadScreenshotUrl(id).then((u) => {
      if (!alive) {
        if (u) URL.revokeObjectURL(u)
        return
      }
      objectUrl = u
      setUrl(u)
    })
    return () => {
      alive = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      setUrl(undefined)
    }
  }, [id])
  return url
}
