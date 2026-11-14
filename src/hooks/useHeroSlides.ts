import { heroSlidesResource } from '@/api/tmdb'
import { useResource } from '@/hooks/useResource'

export function useHeroSlides() {
  const { data, error, isLoading, reload } = useResource(heroSlidesResource)

  return { slides: data ?? null, error, isLoading, reload }
}
