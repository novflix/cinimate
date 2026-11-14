import { useEffect, useState } from 'react'
import { getTitleDetails, type TitleDetails } from '@/api/details'
import type { MediaKind } from '@/api/tmdb'

// The page remounts per title (see `key` in TitlePage), so the state never has to be reset.
export function useTitleDetails(kind: MediaKind, id: number) {
  const [details, setDetails] = useState<TitleDetails | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true

    getTitleDetails(kind, id)
      .then((data) => {
        if (active) setDetails(data)
      })
      .catch((cause: unknown) => {
        if (!active) return
        console.error(cause)
        setError(true)
      })

    return () => {
      active = false
    }
  }, [kind, id])

  return { details, error, isLoading: !details && !error }
}