import { useCallback, useEffect, useSyncExternalStore } from 'react'
import type { Resource } from '@/api/resource'

/**
 * Subscribes a component to a `Resource`. When the data was preloaded (or visited before), the
 * first render already has it, so switching tabs does not flash a skeleton.
 */
export function useResource<T>(resource: Resource<T>) {
  const state = useSyncExternalStore(resource.subscribe, resource.getState, resource.getState)

  useEffect(() => {
    // `get` (unlike `prefetch`) surfaces failures, because this component is on screen waiting.
    void resource.get().catch(() => {})
  }, [resource])

  const reload = useCallback(() => {
    resource.invalidate()
    void resource.get().catch(() => {})
  }, [resource])

  const hasError = state.data === undefined && state.status === 'error'

  return {
    data: state.data,
    error: hasError ? state.error : null,
    isLoading: state.data === undefined && !hasError,
    reload,
  }
}
