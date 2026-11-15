import type { MediaKind } from '@/api/tmdb'

/** A title is identified by its TMDB id and kind; everything else is loaded from TMDB. */
export type TitleRef = {
  kind: MediaKind
  id: number
}

/** Title key → the time it was saved, in seconds since epoch. */
export type SavedTitles = Record<string, number>

export type Library = {
  watchlist: SavedTitles
  watched: SavedTitles
}

export type LibraryStats = {
  watched: number
  queued: number
  movies: number
  series: number
}

export const emptyLibrary: Library = { watchlist: {}, watched: {} }

/**
 * Firestore document `users/{uid}`:
 *
 *   { w: { m603: 1794754892, s1399: 1794754901 }, d: { m550: 1794750000 } }
 *
 * `w` is the watchlist and `d` the watched titles. A key is the kind (`m` movie, `s` series) plus
 * the TMDB id, the value is when the user saved it (only used for ordering, newest first).
 * That is all the app stores: about 20 bytes per title. Titles, posters and ratings come from
 * TMDB, so they are never stale and never copied into the database.
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

export function decodeLibrary(data: unknown): Library {
  if (typeof data !== 'object' || data === null) return emptyLibrary

  const { w, d } = data as { w?: unknown; d?: unknown }
  return { watchlist: decodeSaved(w), watched: decodeSaved(d) }
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
