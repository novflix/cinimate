import type { MediaKind } from '@/api/tmdb'
import { isValidRating } from '@/lib/rating'

/** A title is identified by its TMDB id and kind; everything else is loaded from TMDB. */
export type TitleRef = {
  kind: MediaKind
  id: number
}

/** What the rating dialog needs to know about a title; the name is only shown to the user. */
export type RatingSubject = TitleRef & { title?: string }

/** Title key → the time it was saved, in seconds since epoch. */
export type SavedTitles = Record<string, number>

/** Title key → the user's rating, a whole number from 1 to 10. */
export type Ratings = Record<string, number>

export type Library = {
  watchlist: SavedTitles
  watched: SavedTitles
  ratings: Ratings
  /** Titles the user marked "Not interested" in the For You feed. */
  dismissed: SavedTitles
}

export type LibraryStats = {
  watched: number
  queued: number
  movies: number
  series: number
}

export const emptyLibrary: Library = { watchlist: {}, watched: {}, ratings: {}, dismissed: {} }

/**
 * The hidden list keeps the newest titles only, so the user document can never grow without
 * bound (about 20 bytes per title, so even the cap is a few tens of kilobytes).
 */
export const MAX_DISMISSED = 1500

/**
 * Firestore document `users/{uid}`:
 *
 *   {
 *     w: { m603: 1794754892, s1399: 1794754901 },
 *     d: { m550: 1794750000 },
 *     r: { m550: 9 },
 *     x: { m27205: 1794760000 },
 *   }
 *
 * `w` is the watchlist and `d` the watched titles. A key is the kind (`m` movie, `s` series) plus
 * the TMDB id, the value is when the user saved it (only used for ordering, newest first).
 * `r` holds the user's own rating (1–10) of a watched title, with the same keys: it is the
 * taste signal for the recommendations. A title can be watched without a rating (the user may
 * skip it), and unmarking a title as watched removes its rating too.
 * `x` holds the titles the user hid from the For You feed ("Not interested"), in the same format
 * as `w` and `d`. The recommendations treat them as a negative taste signal and never show them
 * again. That is all the app stores: about 20 bytes per title. Titles and posters come from TMDB,
 * so they are never stale and never copied into the database.
 */
export function titleKey({ kind, id }: TitleRef): string {
  return `${kind === 'movie' ? 'm' : 's'}${id}`
}

const KEY_PATTERN = /^([ms])(\d+)$/

export function parseTitleKey(key: string): TitleRef | null {
  const match = KEY_PATTERN.exec(key)
  if (!match) return null

  return { kind: match[1] === 'm' ? 'movie' : 'series', id: Number(match[2]) }
}

export function nowInSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

function decodeSaved(value: unknown): SavedTitles {
  if (typeof value !== 'object' || value === null) return {}

  const saved: SavedTitles = {}
  for (const [key, time] of Object.entries(value)) {
    // Anything that is not a valid key and time is skipped instead of breaking the profile.
    if (parseTitleKey(key) && typeof time === 'number' && Number.isFinite(time)) {
      saved[key] = time
    }
  }

  return saved
}

function decodeRatings(value: unknown): Ratings {
  if (typeof value !== 'object' || value === null) return {}

  const ratings: Ratings = {}
  for (const [key, rating] of Object.entries(value)) {
    if (parseTitleKey(key) && isValidRating(rating)) ratings[key] = rating
  }

  return ratings
}

export function decodeLibrary(data: unknown): Library {
  if (typeof data !== 'object' || data === null) return emptyLibrary

  const { w, d, r, x } = data as { w?: unknown; d?: unknown; r?: unknown; x?: unknown }
  return {
    watchlist: decodeSaved(w),
    watched: decodeSaved(d),
    ratings: decodeRatings(r),
    dismissed: decodeSaved(x),
  }
}

/** Newest save first. */
export function newestFirst(saved: SavedTitles): TitleRef[] {
  return Object.entries(saved)
    .sort(([, a], [, b]) => b - a)
    .flatMap(([key]) => {
      const ref = parseTitleKey(key)
      return ref ? [ref] : []
    })
}

export function selectStats(watchlist: TitleRef[], watched: TitleRef[]): LibraryStats {
  const movies = watched.filter((ref) => ref.kind === 'movie').length

  return {
    watched: watched.length,
    queued: watchlist.length,
    movies,
    series: watched.length - movies,
  }
}
