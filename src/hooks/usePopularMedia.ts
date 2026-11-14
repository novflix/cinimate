import { popularMediaResource } from '@/api/tmdb'
import { useResource } from '@/hooks/useResource'

export function usePopularMedia() {
  const { data, error, isLoading, reload } = useResource(popularMediaResource)

  return { media: data ?? null, error, isLoading, reload }
}
