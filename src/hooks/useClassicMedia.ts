import { classicMediaResource } from '@/api/tmdb'
import { useResource } from '@/hooks/useResource'

export function useClassicMedia() {
  const { data, error, isLoading, reload } = useResource(classicMediaResource)

  return { media: data ?? null, error, isLoading, reload }
}
