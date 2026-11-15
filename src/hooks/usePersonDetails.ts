import { personDetailsResource } from '@/api/person'
import { useResource } from '@/hooks/useResource'

// The page remounts per person (see `key` in PersonPage), so the resource is selected per render.
export function usePersonDetails(id: number) {
  const { data, error, isLoading, reload } = useResource(personDetailsResource(id))

  return { person: data ?? null, error, isLoading, reload }
}