import { nowPlayingMediaResource } from '@/api/tmdb'
import { useResource } from '@/hooks/useResource'

export function useNowPlayingMedia() {
  const { data, error, isLoading, reload } = useResource(nowPlayingMediaResource)

  return { media: data ?? null, error, isLoading, reload }
}
