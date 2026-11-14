export type ResourceStatus = 'idle' | 'loading' | 'success' | 'error'

export type ResourceState<T> = {
  data: T | undefined
  error: unknown
  status: ResourceStatus
}

export type Resource<T> = {
  /** Resolves with the current data, or starts a fetch when there is none. */
  get: () => Promise<T>
  /** Cached data without starting a request — lets a hook render instantly. */
  peek: () => T | undefined
  getState: () => ResourceState<T>
  subscribe: (listener: () => void) => () => void
  /** Warms the cache in the background. Never rejects. */
  prefetch: () => Promise<void>
  /** Marks the data as stale so the next request refreshes it. */
  invalidate: () => void
}

type ResourceOptions = {
  /** Successful data is reused for this long before a background refresh starts. */
  staleTime?: number
}

const DEFAULT_STALE_TIME = 10 * 60_000

/**
 * A tiny request cache for a single loader: de-duplicates concurrent calls, keeps the last
 * result, and refreshes stale data in the background while the cached data stays on screen.
 */
export function createResource<T>(
  loader: () => Promise<T>,
  { staleTime = DEFAULT_STALE_TIME }: ResourceOptions = {},
): Resource<T> {
  let state: ResourceState<T> = { data: undefined, error: null, status: 'idle' }
  let updatedAt = 0
  let inFlight: Promise<T> | null = null
  let reportInFlightError = false
  const listeners = new Set<() => void>()

  const setState = (next: ResourceState<T>) => {
    state = next
    listeners.forEach((listener) => listener())
  }

  const isFresh = () => state.data !== undefined && Date.now() - updatedAt < staleTime

  const refresh = (reportError: boolean): Promise<T> => {
    if (inFlight) {
      // A real request joining a speculative prefetch makes its failure visible to the UI.
      reportInFlightError ||= reportError
      return inFlight
    }

    reportInFlightError = reportError

    // Keep previously loaded data visible while refreshing it, so the UI never falls back to a
    // skeleton just because the cache went stale.
    if (state.data === undefined) {
      setState({ data: undefined, error: null, status: 'loading' })
    }

    inFlight = loader()
      .then((data) => {
        updatedAt = Date.now()
        setState({ data, error: null, status: 'success' })
        return data
      })
      .catch((error: unknown) => {
        const hasData = state.data !== undefined
        const visible = reportInFlightError

        setState({
          data: state.data,
          error: visible ? error : null,
          status: hasData ? 'success' : visible ? 'error' : 'idle',
        })
        throw error
      })
      .finally(() => {
        inFlight = null
        reportInFlightError = false
      })

    return inFlight
  }

  return {
    get() {
      if (state.data !== undefined) {
        if (!isFresh() && !inFlight) void refresh(false).catch(() => {})
        return Promise.resolve(state.data)
      }

      return refresh(true)
    },

    peek() {
      return state.data
    },

    getState() {
      return state
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    prefetch() {
      if (isFresh()) return Promise.resolve()
      if (inFlight) return inFlight.then(
        () => undefined,
        () => undefined,
      )

      // Speculative loads stay silent: a failed prefetch returns the resource to idle so the
      // real tab visit can retry without flashing an error first.
      return refresh(false).then(
        () => undefined,
        () => undefined,
      )
    },

    invalidate() {
      updatedAt = 0
    },
  }
}
