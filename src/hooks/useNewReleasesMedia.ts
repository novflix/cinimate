import { useEffect, useState } from 'react'
import { getNewReleasesMedia, type NewReleasesMedia } from '@/api/tmdb'

export function useNewReleasesMedia() {
  const [media, setMedia] = useState<NewReleasesMedia | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true

    getNewReleasesMedia()
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