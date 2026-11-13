import { useEffect, useState } from 'react'
import { getNowPlayingMedia, type NowPlayingMedia } from '@/api/tmdb'

export function useNowPlayingMedia() {
  const [media, setMedia] = useState<NowPlayingMedia | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true

    getNowPlayingMedia()
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