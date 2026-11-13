/**
 * Filtering primitives for TMDB results.
 *
 * Two layers, because not every endpoint supports server-side filtering:
 *   - `genreQuery()` and `withServerDefaults()` (tmdb.ts) build query params for `/discover/*`;
 *   - predicates (`withoutGenres`, `isRated`, …) run on the returned items and work for any list
 *     (`/trending`, `/movie/popular`, `/search`, …).
 *
 * Compose predicates with `applyFilters` so new rules stay one-liners.
 *
 * `baselineFilters` is the app-wide quality gate for released titles: every list that reaches the
 * UI goes through it (see `loadPopularList` and `loadHeroSlides` in tmdb.ts). Unreleased titles
 * have no votes yet, so they use `upcomingFilters`, which relies on popularity instead. To tighten
 * the catalogue, change a value in `QUALITY` or add a predicate to either array — no per-tab
 * changes needed. New TMDB lists (search, For You, …) must go through `applyFilters` with one of
 * them as well.
 */

/** TMDB genre ids used by the app. Full list: https://developer.themoviedb.org/reference/genre-movie-list */
export const GENRES = {
  animation: 16,
  news: 10763,
  talkShow: 10767,
} as const

/**
 * Quality thresholds for the whole app. Tune these first when junk slips through
 * (or when too much is being hidden).
 */
export const QUALITY = {
  /** Titles with fewer votes are treated as unknown and hidden. */
  minVotes: 25,
  /** Minimum vote average; 1 simply drops unrated (0.0) titles, raise it to hide weak ones. */
  minRating: 1,
  /** Movies shorter than this (minutes) are shorts/featurettes. Server-side `/discover/movie` only. */
  minFeatureRuntime: 40,
  /** Original languages of regional cinema that floods TMDB with low-profile releases. */
  obscureLanguages: ['hi', 'bn', 'ta', 'te', 'ml', 'kn', 'mr', 'pa', 'gu', 'or', 'ur'],
  /** Titles in `obscureLanguages` must clear this bar: global hits pass, local obscurities don't. */
  obscureLanguageMinVotes: 200,
  /** Animation is full of tiny, barely-rated titles, so it gets a higher bar. */
  animationMinVotes: 50,
  /** Upcoming titles have no votes yet, so TMDB popularity is the quality signal instead. */
  upcomingMinPopularity: 5,
  upcomingObscureLanguageMinPopularity: 60,
  upcomingAnimationMinPopularity: 25,
} as const

/** Every TMDB media result that carries genre ids (movies, series, trending items). */
export type GenreTagged = {
  genre_ids?: number[]
}

/** Every field the filters may look at; all optional because endpoints return different subsets. */
export type FilterableMedia = GenreTagged & {
  adult?: boolean
  overview?: string
  poster_path?: string | null
  vote_average?: number
  vote_count?: number
  popularity?: number
  original_language?: string
}

/** Predicate over a TMDB item. The optional label names the rule in `rejectionReport`. */
export type MediaFilter = ((item: FilterableMedia) => boolean) & { label?: string }

function rule(label: string, test: (item: FilterableMedia) => boolean): MediaFilter {
  return Object.assign(test, { label })
}

/** Keeps items that have none of the given genres. */
export function withoutGenres(...genreIds: number[]): MediaFilter {
  return rule('withoutGenres', (item) => !item.genre_ids?.some((id) => genreIds.includes(id)))
}

/** Keeps only items that have at least one of the given genres. */
export function withGenres(...genreIds: number[]): MediaFilter {
  return rule('withGenres', (item) => item.genre_ids?.some((id) => genreIds.includes(id)) ?? false)
}

/** Drops adult titles. */
export function notAdult(): MediaFilter {
  return rule('notAdult', (item) => !item.adult)
}

/** Drops titles without a poster — cards are portrait, so they would render as empty tiles. */
export function hasPoster(): MediaFilter {
  return rule('hasPoster', (item) => Boolean(item.poster_path))
}

/** Drops titles without a description (usually untranslated or unfinished TMDB entries). */
export function hasOverview(): MediaFilter {
  return rule('hasOverview', (item) => Boolean(item.overview?.trim()))
}

/** Keeps titles with enough votes and a non-zero rating. */
export function isRated(minVotes: number, minRating: number): MediaFilter {
  return rule('isRated', (item) => (item.vote_count ?? 0) >= minVotes && (item.vote_average ?? 0) >= minRating)
}

/** Titles in the given original languages must have at least `minVotes` votes; others pass. */
export function minVotesForLanguages(
  languages: readonly string[],
  minVotes: number,
): MediaFilter {
  return rule('minVotesForLanguages', (item) =>
    !item.original_language ||
    !languages.includes(item.original_language) ||
    (item.vote_count ?? 0) >= minVotes)
}

/** Titles with any of the given genres must have at least `minVotes` votes; others pass. */
export function minVotesForGenres(genreIds: readonly number[], minVotes: number): MediaFilter {
  return rule('minVotesForGenres', (item) =>
    !item.genre_ids?.some((id) => genreIds.includes(id)) || (item.vote_count ?? 0) >= minVotes)
}

/** Keeps titles with at least the given TMDB popularity. */
export function minPopularity(minimum: number): MediaFilter {
  return rule('minPopularity', (item) => (item.popularity ?? 0) >= minimum)
}

/** Titles in the given original languages must have at least `minimum` popularity; others pass. */
export function minPopularityForLanguages(
  languages: readonly string[],
  minimum: number,
): MediaFilter {
  return rule('minPopularityForLanguages', (item) =>
    !item.original_language ||
    !languages.includes(item.original_language) ||
    (item.popularity ?? 0) >= minimum)
}

/** Titles with any of the given genres must have at least `minimum` popularity; others pass. */
export function minPopularityForGenres(genreIds: readonly number[], minimum: number): MediaFilter {
  return rule('minPopularityForGenres', (item) =>
    !item.genre_ids?.some((id) => genreIds.includes(id)) || (item.popularity ?? 0) >= minimum)
}

// Rules that hold for every title, released or not. The card only shows the poster, title and
// dates, so a title without a poster is always dropped.
const commonFilters: MediaFilter[] = [notAdult(), hasPoster()]

/**
 * The app-wide quality gate for released titles. Applied to every list shown in the UI, on top
 * of any tab-specific filters.
 */
export const baselineFilters: MediaFilter[] = [
  ...commonFilters,
  hasOverview(),
  isRated(QUALITY.minVotes, QUALITY.minRating),
  minVotesForLanguages(QUALITY.obscureLanguages, QUALITY.obscureLanguageMinVotes),
  minVotesForGenres([GENRES.animation], QUALITY.animationMinVotes),
]

/**
 * The quality gate for titles that have not come out yet. They have no votes, so the vote-based
 * rules of `baselineFilters` would hide all of them; the same ideas are expressed via popularity.
 * There is no `hasOverview()` here: announced titles often have no description yet, and the card
 * does not show one.
 */
export const upcomingFilters: MediaFilter[] = [
  ...commonFilters,
  minPopularity(QUALITY.upcomingMinPopularity),
  minPopularityForLanguages(QUALITY.obscureLanguages, QUALITY.upcomingObscureLanguageMinPopularity),
  minPopularityForGenres([GENRES.animation], QUALITY.upcomingAnimationMinPopularity),
]

/** Applies every filter (logical AND) and keeps the item type intact. */
export function applyFilters<T extends FilterableMedia>(items: T[], filters: MediaFilter[]): T[] {
  return items.filter((item) => filters.every((filter) => filter(item)))
}

/**
 * For every rule, counts how many items it was the first to reject. Used by the dev-only log in
 * tmdb.ts to show which rule is shrinking a list.
 */
export function rejectionReport<T extends FilterableMedia>(
  items: T[],
  filters: MediaFilter[],
): Record<string, number> {
  const report: Record<string, number> = {}

  for (const item of items) {
    const failed = filters.find((filter) => !filter(item))
    if (failed) {
      const label = failed.label ?? 'unnamed'
      report[label] = (report[label] ?? 0) + 1
    }
  }

  return report
}

/** `without_genres=16` — server-side counterpart of `withoutGenres` for `/discover/*`. */
export function genreQuery(
  param: 'with_genres' | 'without_genres',
  genreIds: number[],
): string {
  return `${param}=${genreIds.join(',')}`
}