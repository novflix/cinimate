import { titleDetailsResource } from '@/api/details'
import type { MediaKind } from '@/api/tmdb'
import { useResource } from '@/hooks/useResource'

// The page remounts per title (see `key` in TitlePage), so the resource is selected per render.
export function useTitleDetails(kind: MediaKind, id: number) {
  const { data, error, isLoading, reload } = useResource(titleDetailsResource(kind, id))

  return { details: data ?? null, error, isLoading, reload }
}
