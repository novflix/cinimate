import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { deleteField, doc, onSnapshot, setDoc } from 'firebase/firestore'
import { useAuth } from '@/hooks/useAuth'
import { db } from '@/lib/firebase'
import {
  decodeLibrary,
  emptyLibrary,
  newestFirst,
  nowInSeconds,
  selectStats,
  titleKey,
  type Library,
} from '@/lib/library'
import { LibraryContext, type LibraryContextValue } from './libraryContext'

type LibraryState = { uid: string | null; library: Library; ready: boolean }

/** A brand-new account on a slow or offline connection should not show a spinner forever. */
const READY_TIMEOUT = 4000

const userRef = (uid: string) => doc(db, 'users', uid)

/**
 * Keeps the signed-in user's watchlist and watched titles in Firestore (`users/{uid}`, see
 * `lib/library.ts` for the format). The live snapshot is the single source of truth: a click
 * writes to Firestore, and the SDK reports that write back immediately from its local cache, so
 * the UI updates instantly and also works offline.
 */
function LibraryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const uid = user?.uid ?? null

  const [state, setState] = useState<LibraryState>({ uid, library: emptyLibrary, ready: !uid })

  // Another account signed in: drop the previous lists during render so no frame shows them.
  if (state.uid !== uid) setState({ uid, library: emptyLibrary, ready: !uid })
  const isCurrent = state.uid === uid
  const library = isCurrent ? state.library : emptyLibrary
  const ready = isCurrent ? state.ready : !uid

  useEffect(() => {
    if (!uid) return

    const timer = window.setTimeout(() => {
      setState((previous) =>
        previous.uid === uid && !previous.ready ? { ...previous, ready: true } : previous,
      )
    }, READY_TIMEOUT)

    const unsubscribe = onSnapshot(
      userRef(uid),
      (snapshot) => {
        // A first snapshot from the empty device cache says nothing about the account yet;
        // wait for the server so existing users do not see their lists vanish for a moment.
        const isUnknownYet = snapshot.metadata.fromCache && !snapshot.exists()
        setState({ uid, library: decodeLibrary(snapshot.data()), ready: !isUnknownYet })
      },
      (error) => {
        // Most likely the security rules have not been published yet (see firestore.rules).
        console.error('[library] cannot read saved titles', error)
        setState({ uid, library: emptyLibrary, ready: true })
      },
    )

    return () => {
      window.clearTimeout(timer)
      unsubscribe()
    }
  }, [uid])

  // Only the keys that changed are sent, so two devices never overwrite each other's lists.
  const save = useCallback(
    (changes: { w?: Record<string, unknown>; d?: Record<string, unknown> }) => {
      if (!uid) return

      void setDoc(userRef(uid), changes, { merge: true }).catch((error: unknown) =>
        console.error('[library] cannot save', error),
      )
    },
    [uid],
  )

  const value = useMemo<LibraryContextValue>(() => {
    const watchlist = newestFirst(library.watchlist)
    const watched = newestFirst(library.watched)

    return {
      ready,
      watchlist,
      watched,
      stats: selectStats(watchlist, watched),
      isWatchlisted: (title) => titleKey(title) in library.watchlist,
      isWatched: (title) => titleKey(title) in library.watched,

      toggleWatchlist: (title) => {
        const key = titleKey(title)
        save({ w: { [key]: key in library.watchlist ? deleteField() : nowInSeconds() } })
      },

      toggleWatched: (title) => {
        const key = titleKey(title)

        if (key in library.watched) save({ d: { [key]: deleteField() } })
        else save({ d: { [key]: nowInSeconds() }, w: { [key]: deleteField() } })
      },
    }
  }, [library, ready, save])

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
}

export default LibraryProvider
