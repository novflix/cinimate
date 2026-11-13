import { useEffect, useState } from 'react'
import { getHeroSlides, type HeroSlide } from '@/api/tmdb'

export function useHeroSlides() {
  const [slides, setSlides] = useState<HeroSlide[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    getHeroSlides()
      .then((data) => {
        if (active) setSlides(data)
      })
      .catch((cause: unknown) => {
        if (!active) return
        console.error(cause)
        setError(cause instanceof Error ? cause.message : 'Unable to load featured titles.')
      })

    return () => {
      active = false
    }
  }, [])

  return { slides, error, isLoading: !slides && !error }
}
