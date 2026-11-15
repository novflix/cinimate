import { trendingTodayResource } from '@/api/tmdb'
import { useResource } from '@/hooks/useResource'

export function useTrendingToday() {
  const { data, error, isLoading, reload } = useResource(trendingTodayResource)

  return { media: data ?? null, error, isLoading, reload }
}
