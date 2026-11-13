import { useEffect, useState } from 'react'
import { getClassicMedia, type ClassicMedia } from '@/api/tmdb'

export function useClassicMedia() {
  const [media, setMedia] = useState<ClassicMedia | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true

    getClassicMedia()
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