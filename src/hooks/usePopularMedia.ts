import { useEffect, useState } from 'react'
import { getPopularMedia, type PopularMedia } from '@/api/tmdb'

export function usePopularMedia() {
  const [media, setMedia] = useState<PopularMedia | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true

    getPopularMedia()
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
