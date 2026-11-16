import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { PopularMediaItem } from '@/api/tmdb'
import { useAuth } from '@/hooks/useAuth'
import { useLibrary } from '@/hooks/useLibrary'
import type { Library } from '@/lib/library'
import { REC } from '@/recommendations/config'
import { createFeedEngine, type FeedEngine } from '@/recommendations'

/** Titles added to the feed per request: four to five rows on desktop. */
const PAGE_SIZE = 24

export type FeedState = {
  items: PopularMediaItem[]
  status: 'idle' | 'loading' | 'error'
  /** Nothing more to load. */
  done: boolean
  /** The user has too little history, so the feed is a general mix. */
  cold: boolean
}

type Session = {
  uid: string
  createdAt: number
  engine: FeedEngine
  state: FeedState
  listeners: Set<() => void>
  loading: boolean
  loadMore: (library: Library) => Promise<void>
}

const initialState: FeedState = { items: [], status: 'idle', done: false, cold: true }

/**
 * The open feed lives outside React, so opening a title and coming back shows the same cards
 * at once instead of a new feed. It is dropped after a while, on a new account or on refresh.
 */
let current: Session | null = null

function createSession(uid: string): Session {
  const session: Session = {
    uid,
    createdAt: Date.now(),
    engine: createFeedEngine(uid),
    state: initialState,
    listeners: new Set(),
    loading: false,
    loadMore: async (library) => {
      if (session.loading || session.state.done) return
      session.loading = true
      set({ status: 'loading' })

      try {
        const page = await session.engine.next(PAGE_SIZE, library)
        const seen = new Set(session.state.items.map((item) => `${item.kind}-${item.id}`))
        const fresh = page.filter((item) => !seen.has(`${item.kind}-${item.id}`))

        set({
          items: [...session.state.items, ...fresh],
          status: 'idle',
          done: !session.engine.hasMore() || page.length === 0,
          cold: session.engine.isCold(),
        })
      } catch (error) {
        console.error('[recommendations] cannot load the feed', error)
        set({ status: 'error' })
      } finally {
        session.loading = false
      }
    },
  }

  function set(patch: Partial<FeedState>) {
    session.state = { ...session.state, ...patch }
    session.listeners.forEach((listener) => listener())
  }

  return session
}

function acquire(uid: string): Session {
  const expired = current && Date.now() - current.createdAt > REC.sessionMinutes * 60_000

  if (!current || current.uid !== uid || expired) current = createSession(uid)
  return current
}

/** `enabled` is false while the user has too little history: no requests are made for a feed that is not shown. */
export function useRecommendationFeed(enabled = true) {
  const { user } = useAuth()
  const { library, ready } = useLibrary()
  const uid = user?.uid ?? ''

  const [session, setSession] = useState(() => acquire(uid))

  // Another account signed in: switch to its own feed during render so no frame shows the old one.
  if (session.uid !== uid) setSession(acquire(uid))
  const state = useSyncExternalStore(
    (listener) => {
      session.listeners.add(listener)
      return () => session.listeners.delete(listener)
    },
    () => session.state,
  )

  // Callbacks read the newest library through a ref, so a late scroll never uses stale data.
  const libraryRef = useRef(library)
  useEffect(() => {
    libraryRef.current = library
  }, [library])

  const loadMore = useCallback(() => session.loadMore(libraryRef.current), [session])

  // First page, once the saved library has arrived (a half-loaded library looks like a new user).
  const isEmpty = state.items.length === 0
  const canStart = enabled && ready && uid !== '' && isEmpty && state.status === 'idle' && !state.done
  useEffect(() => {
    if (canStart) void loadMore()
  }, [canStart, loadMore])

  /** A brand-new feed: the ranking is recomputed from scratch and the old cards are dropped. */
  const refresh = useCallback(() => {
    current = createSession(uid)
    setSession(current)
  }, [uid])

  return { ...state, uid, loadMore, refresh }
}
