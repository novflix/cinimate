import { comingSoonMediaResource } from '@/api/tmdb'
import { useResource } from '@/hooks/useResource'

export function useComingSoonMedia() {
  const { data, error, isLoading, reload } = useResource(comingSoonMediaResource)

  return { media: data ?? null, error, isLoading, reload }
}
