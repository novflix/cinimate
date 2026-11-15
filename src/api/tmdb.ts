import {
  applyFilters,
  baselineFilters,
  GENRES,
  genreQuery,
  QUALITY,
  rejectionReport,
  upcomingFilters,
  withoutGenres,
  type MediaFilter,
} from '@/api/filters'
import { createResource } from '@/api/resource'

const API_ROOT = 'https://api.themoviedb.org/3'
const IMAGE_ROOT = 'https://image.tmdb.org/t/p'
const REQUEST_TIMEOUT_MS = 20_000

const HERO_SLIDE_COUNT = 12

// A rail shows up to LIST_SIZE titles. Filters can drop many of them, so LIST_PAGES pages are
// fetched up front to keep the rails full after filtering.
const LIST_PAGES = 2
const LIST_SIZE = 20

export type MediaKind = 'movie' | 'series'

export type HeroSlide = {
  id: number
  kind: MediaKind
  title: string
  year: string
  rating: number
  votes: number
  overview: string
  backdrop: string
}

type TmdbBase = {
  id: number
  overview: string
  vote_average: number
  vote_count: number
  popularity: number
  backdrop_path: string | null
  poster_path: string | null
  adult?: boolean
}

export type TmdbTrendingItem = TmdbBase & {
  media_type?: 'movie' | 'tv' | 'person'
  title?: string
  name?: string
  release_date?: string
  first_air_date?: string
  genre_ids?: number[]
  original_language?: string
}

type TmdbList<T> = {
  results: T[]
}

const token = import.meta.env.VITE_TMDB_TOKEN?.trim()

export async function getJson<T>(path: string): Promise<T> {
  if (!token) {
    throw new Error('TMDB read token is missing. Add VITE_TMDB_TOKEN to .env.local.')
  }

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${API_ROOT}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        accept: 'application/json',
      },
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`TMDB request failed with ${response.status} for ${path}`)
    }

    return (await response.json()) as T
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`TMDB request timed out for ${path}`)
    }

    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

function toSlide(item: TmdbTrendingItem, kind: MediaKind): HeroSlide | null {
  const title = kind === 'movie' ? item.title : item.name
  const date = kind === 'movie' ? item.release_date : item.first_air_date

  if (!item.backdrop_path || !item.overview || item.adult || !title) return null

  return {
    id: item.id,
    kind,
    title,
    year: (date ?? '').slice(0, 4),
    rating: item.vote_average,
    votes: item.vote_count,
    overview: item.overview,
    backdrop: item.backdrop_path,
  }
}

async function loadHeroSlides(): Promise<HeroSlide[]> {
  const trending = await getJson<TmdbList<TmdbTrendingItem>>(
    '/trending/all/week?language=en-US',
  )

  return applyFilters(trending.results, [
    ...baselineFilters,
    withoutGenres(GENRES.talkShow, GENRES.news),
  ])
    .filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
    .flatMap((item) => {
      const slide = toSlide(item, item.media_type === 'movie' ? 'movie' : 'series')
      return slide ? [slide] : []
    })
    .slice(0, HERO_SLIDE_COUNT)
}

export const heroSlidesResource = createResource(loadHeroSlides, {
  staleTime: 5 * 60_000,
})

export function backdropUrl(
  path: string,
  size: 'w780' | 'w1280' | 'original' = 'w1280',
): string {
  return `${IMAGE_ROOT}/${size}${path}`
}

export function posterUrl(
  path: string,
  size: 'w185' | 'w342' | 'w500' = 'w342',
): string {
  return `${IMAGE_ROOT}/${size}${path}`
}

// Profile photos use their own size set (w45, w185, h632, original).
export function profileUrl(path: string, size: 'w185' | 'h632' = 'w185'): string {
  return `${IMAGE_ROOT}/${size}${path}`
}

export function formatRating(rating: number): string {
  return rating.toFixed(1).replace('.', ',')
}

export function formatVotes(votes: number): string {
  if (votes >= 1_000_000) {
    return `${(votes / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`
  }

  if (votes >= 1_000) {
    return `${(votes / 1_000).toFixed(1).replace(/\.0$/, '')}k`
  }

  return String(votes)
}

export type PopularMediaItem = {
  id: number
  kind: MediaKind
  title: string
  year: string
  rating: number
  backdrop: string | null
  poster: string | null
  popularity: number
  /** Full release / first air date as `YYYY-MM-DD`, or an empty string when unknown. */
  releaseDate: string
}

export type PopularMedia = {
  movies: PopularMediaItem[]
  series: PopularMediaItem[]
  animation: PopularMediaItem[]
}

export function toPopularMediaItem(
  item: TmdbTrendingItem,
  kind: MediaKind,
): PopularMediaItem | null {
  const title = kind === 'movie' ? item.title : item.name
  const date = kind === 'movie' ? item.release_date : item.first_air_date

  if (!title || item.adult || (!item.backdrop_path && !item.poster_path)) return null

  return {
    id: item.id,
    kind,
    title,
    year: (date ?? '').slice(0, 4),
    rating: item.vote_average,
    backdrop: item.backdrop_path,
    poster: item.poster_path,
    popularity: item.popularity,
    releaseDate: date ?? '',
  }
}

// Server-side counterpart of the baseline filters for `/discover/*`: keeps the pages full of
// usable titles instead of fetching junk only to throw it away. Params a caller already set win.
function withServerDefaults(path: string): string {
  if (!path.startsWith('/discover/')) return path

  const params: string[] = []

  if (!path.includes('vote_count.gte=')) {
    params.push(`vote_count.gte=${QUALITY.minVotes}`)
  }

  if (path.startsWith('/discover/movie') && !path.includes('with_runtime')) {
    params.push(`with_runtime.gte=${QUALITY.minFeatureRuntime}`)
  }

  if (params.length === 0) return path

  return `${path}${path.includes('?') ? '&' : '?'}${params.join('&')}`
}

type ListOptions = {
  /** `upcoming` skips the vote-based rules and server defaults, since unreleased titles have no votes. */
  profile?: 'released' | 'upcoming'
  pages?: number
  limit?: number
}

async function loadPopularList(
  path: string,
  kind: MediaKind,
  filters: MediaFilter[] = [],
  options: ListOptions = {},
): Promise<PopularMediaItem[]> {
  const { profile = 'released', pages = LIST_PAGES, limit = LIST_SIZE } = options
  const url = profile === 'released' ? withServerDefaults(path) : path
  const gate = profile === 'released' ? baselineFilters : upcomingFilters
  const separator = url.includes('?') ? '&' : '?'

  const responses = await Promise.all(
    Array.from({ length: pages }, (_, index) =>
      getJson<TmdbList<TmdbTrendingItem>>(
        `${url}${separator}language=en-US&page=${index + 1}`,
      ),
    ),
  )

  const seen = new Set<number>()
  const rules = [...gate, ...filters]
  const candidates = responses.flatMap((response) => response.results)
  const passed = applyFilters(candidates, rules)

  // Dev only: shows which rule is shrinking a list (open the browser console).
  if (import.meta.env.DEV) {
    console.info(`[filters] ${path}`, {
      fetched: candidates.length,
      kept: passed.length,
      rejectedBy: rejectionReport(candidates, rules),
    })
  }

  return passed
    .flatMap((item) => {
      if (seen.has(item.id)) return []
      seen.add(item.id)

      const media = toPopularMediaItem(item, kind)
      return media ? [media] : []
    })
    .slice(0, limit)
}

// Animation lives in its own rail, so the live-action rails exclude genre 16 on both layers:
// the discover query keeps a full page of non-animated titles, the predicate keeps the rule true
// if a rail is ever pointed at an endpoint that cannot filter (e.g. /tv/popular).
const liveActionOnly = [withoutGenres(GENRES.animation)]
const noAnimation = genreQuery('without_genres', [GENRES.animation])
const animationOnly = genreQuery('with_genres', [GENRES.animation])

async function loadPopularMedia(): Promise<PopularMedia> {
  const [movies, series, animatedMovies, animatedSeries] = await Promise.all([
    loadPopularList(
      `/discover/movie?sort_by=popularity.desc&${noAnimation}`,
      'movie',
      liveActionOnly,
    ),
    loadPopularList(
      `/discover/tv?sort_by=popularity.desc&${noAnimation}`,
      'series',
      liveActionOnly,
    ),
    loadPopularList(`/discover/movie?sort_by=popularity.desc&${animationOnly}`, 'movie'),
    loadPopularList(`/discover/tv?sort_by=popularity.desc&${animationOnly}`, 'series'),
  ])

  return {
    movies,
    series,
    animation: [...animatedMovies, ...animatedSeries]
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, LIST_SIZE),
  }
}

export const popularMediaResource = createResource(loadPopularMedia)

// "Trending Today" is the day's TMDB trending list. It is a lighter quality gate than the
// catalogue rails: a title can trend before it has votes (a new trailer, a premiere), so the
// popularity-based gate is used instead of the released-titles gate.
const TRENDING_PAGES = 2
const TRENDING_LIMIT = 40

async function loadTrendingToday(): Promise<PopularMediaItem[]> {
  const responses = await Promise.all(
    Array.from({ length: TRENDING_PAGES }, (_, index) =>
      getJson<TmdbList<TmdbTrendingItem>>(
        `/trending/all/day?language=en-US&page=${index + 1}`,
      ),
    ),
  )

  const seen = new Set<string>()
  const rules = [...upcomingFilters, withoutGenres(GENRES.talkShow, GENRES.news)]

  return applyFilters(
    responses.flatMap((response) => response.results),
    rules,
  )
    .filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
    .flatMap((item) => {
      const kind: MediaKind = item.media_type === 'movie' ? 'movie' : 'series'
      const key = `${kind}-${item.id}`
      if (seen.has(key)) return []

      seen.add(key)
      const media = toPopularMediaItem(item, kind)
      return media ? [media] : []
    })
    .slice(0, TRENDING_LIMIT)
}

export const trendingTodayResource = createResource(loadTrendingToday, {
  staleTime: 5 * 60_000,
})


export type NowPlayingMedia = {
  movies: PopularMediaItem[]
  animation: PopularMediaItem[]
}

// TMDB region (ISO 3166-1) whose theatrical release dates decide what counts as "in theaters".
const NOW_PLAYING_REGION = 'US'
// A film stays "in theaters" for roughly six weeks after its release.
const NOW_PLAYING_WINDOW_DAYS = 45
// Release types 2 (limited theatrical) | 3 (theatrical) — TMDB treats `|` as OR, `,` as AND.
const THEATRICAL_RELEASE_TYPES = '2|3'

// Local calendar date as `YYYY-MM-DD` (toISOString would shift it to UTC).
function isoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function nowPlayingQuery(): string {
  const today = new Date()
  const windowStart = new Date(today)
  windowStart.setDate(windowStart.getDate() - NOW_PLAYING_WINDOW_DAYS)

  return [
    'sort_by=popularity.desc',
    `region=${NOW_PLAYING_REGION}`,
    `with_release_type=${THEATRICAL_RELEASE_TYPES}`,
    `release_date.gte=${isoDate(windowStart)}`,
    `release_date.lte=${isoDate(today)}`,
  ].join('&')
}

// Only movies are shown in theaters, so unlike Popular there is no "Series" rail.
// Animation keeps its own rail, using the same two-layer genre split as Popular.
async function loadNowPlayingMedia(): Promise<NowPlayingMedia> {
  const query = nowPlayingQuery()

  const [movies, animation] = await Promise.all([
    loadPopularList(`/discover/movie?${query}&${noAnimation}`, 'movie', liveActionOnly),
    loadPopularList(`/discover/movie?${query}&${animationOnly}`, 'movie'),
  ])

  return { movies, animation }
}

export const nowPlayingMediaResource = createResource(loadNowPlayingMedia)

export type ClassicMedia = {
  movies: PopularMediaItem[]
  series: PopularMediaItem[]
  animation: PopularMediaItem[]
}

// Anything released up to and including this date counts as a classic.
const CLASSIC_RELEASED_BEFORE = '1999-12-31'

// Classics are ranked by rating, so a minimum vote count keeps obscure titles with a handful
// of perfect scores out. Series and animation collect far fewer votes than live-action films.
const CLASSIC_MIN_VOTES = {
  movies: 3000,
  series: 300,
  animatedMovies: 1000,
  animatedSeries: 100,
} as const

function classicQuery(kind: MediaKind, minVotes: number): string {
  const dateParam = kind === 'movie' ? 'primary_release_date.lte' : 'first_air_date.lte'

  return [
    'sort_by=vote_average.desc',
    `vote_count.gte=${minVotes}`,
    `${dateParam}=${CLASSIC_RELEASED_BEFORE}`,
  ].join('&')
}

async function loadClassicMedia(): Promise<ClassicMedia> {
  const [movies, series, animatedMovies, animatedSeries] = await Promise.all([
    loadPopularList(
      `/discover/movie?${classicQuery('movie', CLASSIC_MIN_VOTES.movies)}&${noAnimation}`,
      'movie',
      liveActionOnly,
    ),
    loadPopularList(
      `/discover/tv?${classicQuery('series', CLASSIC_MIN_VOTES.series)}&${noAnimation}`,
      'series',
      liveActionOnly,
    ),
    loadPopularList(
      `/discover/movie?${classicQuery('movie', CLASSIC_MIN_VOTES.animatedMovies)}&${animationOnly}`,
      'movie',
    ),
    loadPopularList(
      `/discover/tv?${classicQuery('series', CLASSIC_MIN_VOTES.animatedSeries)}&${animationOnly}`,
      'series',
    ),
  ])

  return {
    movies,
    series,
    animation: [...animatedMovies, ...animatedSeries]
      .sort((a, b) => b.rating - a.rating)
      .slice(0, LIST_SIZE),
  }
}

export const classicMediaResource = createResource(loadClassicMedia)

export type NewReleasesMedia = {
  movies: PopularMediaItem[]
  series: PopularMediaItem[]
  animation: PopularMediaItem[]
}

// "New <year>" is everything that has already come out since January 1st of the current year.
// Upcoming releases belong to the Coming Soon tab, so the range ends today.
function newReleasesRange(kind: MediaKind): string {
  const today = new Date()
  const param = kind === 'movie' ? 'primary_release_date' : 'first_air_date'

  return [
    'sort_by=popularity.desc',
    `${param}.gte=${today.getFullYear()}-01-01`,
    `${param}.lte=${isoDate(today)}`,
  ].join('&')
}

// Talk shows and news programmes are tagged as series but are not what this tab is about.
const seriesOnly = [withoutGenres(GENRES.talkShow, GENRES.news)]

async function loadNewReleasesMedia(): Promise<NewReleasesMedia> {
  const movieRange = newReleasesRange('movie')
  const seriesRange = newReleasesRange('series')

  const [movies, series, animatedMovies, animatedSeries] = await Promise.all([
    loadPopularList(`/discover/movie?${movieRange}&${noAnimation}`, 'movie', liveActionOnly),
    loadPopularList(`/discover/tv?${seriesRange}&${noAnimation}`, 'series', [
      ...liveActionOnly,
      ...seriesOnly,
    ]),
    loadPopularList(`/discover/movie?${movieRange}&${animationOnly}`, 'movie'),
    loadPopularList(`/discover/tv?${seriesRange}&${animationOnly}`, 'series', seriesOnly),
  ])

  return {
    movies,
    series,
    animation: [...animatedMovies, ...animatedSeries]
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, LIST_SIZE),
  }
}

export const newReleasesMediaResource = createResource(loadNewReleasesMedia)

// Coming Soon: titles that come out within the next COMING_SOON_WINDOW_DAYS days. Candidates are
// picked by popularity (the most anticipated ones), then shown soonest first. The date filter and
// the date shown on the card both use TMDB's primary date, so the countdown always matches.
const COMING_SOON_WINDOW_DAYS = 365
const COMING_SOON_PAGES = 4
const COMING_SOON_LIMIT_PER_KIND = 40

function comingSoonRange(kind: MediaKind): string {
  const start = new Date()
  start.setDate(start.getDate() + 1)

  const end = new Date()
  end.setDate(end.getDate() + COMING_SOON_WINDOW_DAYS)

  const param = kind === 'movie' ? 'primary_release_date' : 'first_air_date'

  return [
    'sort_by=popularity.desc',
    `${param}.gte=${isoDate(start)}`,
    `${param}.lte=${isoDate(end)}`,
  ].join('&')
}

async function loadComingSoonMedia(): Promise<PopularMediaItem[]> {
  const options = {
    profile: 'upcoming',
    pages: COMING_SOON_PAGES,
    limit: COMING_SOON_LIMIT_PER_KIND,
  } as const

  const [movies, series] = await Promise.all([
    loadPopularList(`/discover/movie?${comingSoonRange('movie')}`, 'movie', [], options),
    loadPopularList(`/discover/tv?${comingSoonRange('series')}`, 'series', seriesOnly, options),
  ])

  const today = isoDate(new Date())

  return [...movies, ...series]
    .filter((item) => item.releaseDate > today)
    .sort(
      (a, b) =>
        a.releaseDate.localeCompare(b.releaseDate) || b.popularity - a.popularity,
    )
}

export const comingSoonMediaResource = createResource(loadComingSoonMedia)

export function parseIsoDate(value: string): Date {
  const [year = 0, month = 1, day = 1] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** `2026-12-18` → `Dec 18`. The countdown next to it makes the year unambiguous. */
export function formatReleaseDate(date: string): string {
  return parseIsoDate(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Whole calendar days from today until the date (0 = today, negative = already out). */
export function daysUntil(date: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return Math.round((parseIsoDate(date).getTime() - today.getTime()) / 86_400_000)
}

export function formatDaysUntil(date: string): string {
  const days = daysUntil(date)

  if (days <= 0) return 'Today'
  return days === 1 ? '1 day' : `${days} days`
}