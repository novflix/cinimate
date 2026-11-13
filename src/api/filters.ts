/**
 * Filtering primitives for TMDB results.
 *
 * Two layers, because not every endpoint supports server-side filtering:
 *   - `genreQuery()` builds `with_genres` / `without_genres` params for `/discover/*`;
 *   - predicates (`withoutGenres`, `withGenres`, …) run on the returned `genre_ids` and work for
 *     any list (`/trending`, `/movie/popular`, `/search`, …).
 *
 * Compose predicates with `applyFilters` so new rules (year, rating, language, …) stay one-liners.
 */

/** TMDB genre ids used by the app. Full list: https://developer.themoviedb.org/reference/genre-movie-list */
export const GENRES = {
  animation: 16,
  news: 10763,
  talkShow: 10767,
} as const

/** Every TMDB media result that carries genre ids (movies, series, trending items). */
export type GenreTagged = {
  genre_ids?: number[]
}

/** Predicate over a TMDB item. */
export type MediaFilter = (item: GenreTagged) => boolean

/** Keeps items that have none of the given genres. */
export function withoutGenres(...genreIds: number[]): MediaFilter {
  return (item) => !item.genre_ids?.some((id) => genreIds.includes(id))
}

/** Keeps only items that have at least one of the given genres. */
export function withGenres(...genreIds: number[]): MediaFilter {
  return (item) => item.genre_ids?.some((id) => genreIds.includes(id)) ?? false
}

/** Applies every filter (logical AND) and keeps the item type intact. */
export function applyFilters<T extends GenreTagged>(items: T[], filters: MediaFilter[]): T[] {
  return items.filter((item) => filters.every((filter) => filter(item)))
}

/** `without_genres=16` — server-side counterpart of `withoutGenres` for `/discover/*`. */
export function genreQuery(
  param: 'with_genres' | 'without_genres',
  genreIds: number[],
): string {
  return `${param}=${genreIds.join(',')}`
}
