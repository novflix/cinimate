import { createContext } from 'react'
import type { Library, LibraryStats, RatingSubject, TitleRef } from '@/lib/library'

export interface LibraryContextValue {
  /** False until the user's saves have arrived, so the UI can avoid flashing empty lists. */
  ready: boolean
  /** Titles saved to watch later, newest first. */
  watchlist: TitleRef[]
  /** Titles already watched, newest first. */
  watched: TitleRef[]
  stats: LibraryStats
  /** The raw saved data (with timestamps), the input of the recommendations. */
  library: Library
  isWatchlisted: (title: TitleRef) => boolean
  isWatched: (title: TitleRef) => boolean
  toggleWatchlist: (title: TitleRef) => void
  /**
   * Marking a title as watched also takes it off the watchlist and asks the user to rate it
   * (see `ratingPrompt`). Unmarking it removes its rating.
   */
  toggleWatched: (title: RatingSubject) => void
  /** Deletes a title from the watchlist (and from Firestore), e.g. from the profile. */
  removeFromWatchlist: (title: TitleRef) => void
  /** Deletes a title from the watched list (and from Firestore) together with its rating. */
  removeFromWatched: (title: TitleRef) => void
  /** The user's rating (1–10) of a title, or null when it is not rated. */
  getRating: (title: TitleRef) => number | null
  /** Saves a rating for a title the user has watched. */
  rateTitle: (title: TitleRef, rating: number) => void
  /** The title the rating dialog is open for, or null while it is closed. */
  ratingPrompt: RatingSubject | null
  /** Opens the rating dialog, e.g. to change an earlier rating. */
  promptRating: (title: RatingSubject) => void
  dismissRatingPrompt: () => void
  /** Whether the user hid this title from the For You feed. */
  isDismissed: (title: TitleRef) => boolean
  /** "Not interested": hides a title from the feed for good and teaches the feed to show less like it. */
  dismissTitle: (title: TitleRef) => void
  /** Takes a title back out of the hidden list (the Undo of "Not interested"). */
  undoDismiss: (title: TitleRef) => void
}

export const LibraryContext = createContext<LibraryContextValue | null>(null)