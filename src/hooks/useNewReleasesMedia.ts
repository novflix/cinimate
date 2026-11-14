import { newReleasesMediaResource } from '@/api/tmdb'
import { useResource } from '@/hooks/useResource'

export function useNewReleasesMedia() {
  const { data, error, isLoading, reload } = useResource(newReleasesMediaResource)

  return { media: data ?? null, error, isLoading, reload }
}
