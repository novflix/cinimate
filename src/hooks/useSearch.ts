import { useEffect, useRef, useState } from 'react'
import {
  invalidateSearch,
  peekSearch,
  searchMedia,
  type SearchResult,
} from '@/api/search'

const DEBOUNCE_MS = 300
const SKELETON_DELAY_MS = 180
// One character is enough to leave the Trending block and start searching.
const MIN_QUERY_LENGTH = 1

export type SearchStatus = 'idle' | 'loading' | 'ready' | 'error'

export type SearchState = {
  query: string
  results: SearchResult[]
  status: SearchStatus
  /** The first batch is on screen and the remaining sources are still being ranked. */
  isRefining: boolean
  /** Delayed so a cache hit or a very fast request never flashes a skeleton. */
  showSkeleton: boolean
  error: unknown
}

const initialState: SearchState = {
  query: '',
  results: [],
  status: 'idle',
  isRefining: false,
  showSkeleton: false,
  error: null,
}

function loadingState(query: string, showSkeleton = false): SearchState {
  return {
    query,
    results: [],
    status: 'loading',
    isRefining: false,
    showSkeleton,
    error: null,
  }
}

function readyState(query: string, results: SearchResult[]): SearchState {
  return {
    query,
    results,
    status: 'ready',
    isRefining: false,
    showSkeleton: false,
    error: null,
  }
}

/**
 * Debounced progressive search. Cached queries render synchronously on the first frame, a new
 * query shows its skeleton only if it takes longer than a normal response, and results from an
 * older request are dropped instead of replacing the current list.
 */
export function useSearch(query: string): { state: SearchState; retry: () => void } {
  const [state, setState] = useState<SearchState>(initialState)
  const [attempt, setAttempt] = useState(0)
  const requestRef = useRef(0)
  const trimmed = query.trim()

  // What the page should show right now. Deriving the reset/cache-hit instead of setting state
  // from the effect keeps the first frame of a new query free of an extra render.
  const cached = trimmed.length >= MIN_QUERY_LENGTH ? peekSearch(trimmed) : undefined
  const current: SearchState =
    trimmed.length < MIN_QUERY_LENGTH
      ? initialState
      : state.query === trimmed
        ? state
        : cached
          ? readyState(trimmed, cached)
          : loadingState(trimmed)

  useEffect(() => {
    const request = ++requestRef.current

    if (trimmed.length < MIN_QUERY_LENGTH) return
    if (peekSearch(trimmed)) return

    const skeletonTimer = window.setTimeout(() => {
      if (requestRef.current !== request) return
      setState((previous) => {
        // A retry that already has results keeps them on screen while the new request runs;
        // otherwise the page would flash back to an empty skeleton before showing the same list.
        if (previous.query === trimmed && previous.results.length > 0) return previous
        return loadingState(trimmed, true)
      })
    }, SKELETON_DELAY_MS)

    const searchTimer = window.setTimeout(() => {
      if (requestRef.current !== request) return

      const isCurrent = () => requestRef.current === request

      void searchMedia(trimmed, (partial) => {
        if (!isCurrent()) return

        window.clearTimeout(skeletonTimer)

        setState({
          query: trimmed,
          results: partial,
          status: partial.length > 0 ? 'ready' : 'loading',
          isRefining: true,
          showSkeleton: partial.length === 0,
          error: null,
        })
      })
        .then((results) => {
          if (!isCurrent()) return
          setState(readyState(trimmed, results))
        })
        .catch((error: unknown) => {
          if (!isCurrent()) return

          setState((previous) => ({
            ...previous,
            status: previous.results.length > 0 ? 'ready' : 'error',
            isRefining: false,
            showSkeleton: false,
            error: previous.results.length > 0 ? null : error,
          }))
        })
    }, DEBOUNCE_MS)

    return () => {
      window.clearTimeout(skeletonTimer)
      window.clearTimeout(searchTimer)
    }
  }, [trimmed, attempt])

  const retry = () => {
    invalidateSearch(trimmed)
    setAttempt((value) => value + 1)
  }

  return { state: current, retry }
}
