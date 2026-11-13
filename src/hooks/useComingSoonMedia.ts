import { useEffect, useState } from 'react'
import { getComingSoonMedia, type PopularMediaItem } from '@/api/tmdb'

export function useComingSoonMedia() {
  const [media, setMedia] = useState<PopularMediaItem[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true

    getComingSoonMedia()
      .then((data) => {
        if (active) setMedia(data)
      })
      .catch((cause: unknown) => {
        if (!active) return
        console.error(cause)
        setError(true)
      })

    return () => {
      active = false
    }
  }, [])

  return { media, error, isLoading: !media && !error }
}