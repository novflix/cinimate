import { createContext } from 'react'
import type { LibraryStats, TitleRef } from '@/lib/library'

export interface LibraryContextValue {
  /** False until the user's saves have arrived, so the UI can avoid flashing empty lists. */
  ready: boolean
  /** Titles saved to watch later, newest first. */
  watchlist: TitleRef[]
  /** Titles already watched, newest first. */
  watched: TitleRef[]
  stats: LibraryStats
  isWatchlisted: (title: TitleRef) => boolean
  isWatched: (title: TitleRef) => boolean
  toggleWatchlist: (title: TitleRef) => void
  /** Marking a title as watched also takes it off the watchlist. */
  toggleWatched: (title: TitleRef) => void
}

export const LibraryContext = createContext<LibraryContextValue | null>(null)
