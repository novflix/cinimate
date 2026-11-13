import {
  applyFilters,
  baselineFilters,
  GENRES,
  genreQuery,
  QUALITY,
  withoutGenres,
  type MediaFilter,
} from '@/api/filters'

const API_ROOT = 'https://api.themoviedb.org/3'
const IMAGE_ROOT = 'https://image.tmdb.org/t/p'

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

type TmdbTrendingItem = TmdbBase & {
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

async function getJson<T>(path: string): Promise<T> {
  if (!token) {
    throw new Error('TMDB read token is missing. Add VITE_TMDB_TOKEN to .env.local.')
  }

  const response = await fetch(`${API_ROOT}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`TMDB request failed with ${response.status} for ${path}`)
  }

  return (await response.json()) as T
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

let heroSlidesPromise: Promise<HeroSlide[]> | null = null

export function getHeroSlides(): Promise<HeroSlide[]> {
  if (!heroSlidesPromise) {
    heroSlidesPromise = loadHeroSlides().catch((error: unknown) => {
      heroSlidesPromise = null
      throw error
    })
  }

  return heroSlidesPromise
}

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
}

export type PopularMedia = {
  movies: PopularMediaItem[]
  series: PopularMediaItem[]
  animation: PopularMediaItem[]
}

function toPopularMediaItem(item: TmdbTrendingItem, kind: MediaKind): PopularMediaItem | null {
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

async function loadPopularList(
  path: string,
  kind: MediaKind,
  filters: MediaFilter[] = [],
): Promise<PopularMediaItem[]> {
  const url = withServerDefaults(path)
  const separator = url.includes('?') ? '&' : '?'

  const pages = await Promise.all(
    Array.from({ length: LIST_PAGES }, (_, index) =>
      getJson<TmdbList<TmdbTrendingItem>>(
        `${url}${separator}language=en-US&page=${index + 1}`,
      ),
    ),
  )

  const seen = new Set<number>()

  return applyFilters(
    pages.flatMap((page) => page.results),
    [...baselineFilters, ...filters],
  )
    .flatMap((item) => {
      if (seen.has(item.id)) return []
      seen.add(item.id)

      const media = toPopularMediaItem(item, kind)
      return media ? [media] : []
    })
    .slice(0, LIST_SIZE)
}

let popularMediaPromise: Promise<PopularMedia> | null = null

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

export function getPopularMedia(): Promise<PopularMedia> {
  if (!popularMediaPromise) {
    popularMediaPromise = loadPopularMedia().catch((error: unknown) => {
      popularMediaPromise = null
      throw error
    })
  }

  return popularMediaPromise
}

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

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
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

let nowPlayingMediaPromise: Promise<NowPlayingMedia> | null = null

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

export function getNowPlayingMedia(): Promise<NowPlayingMedia> {
  if (!nowPlayingMediaPromise) {
    nowPlayingMediaPromise = loadNowPlayingMedia().catch((error: unknown) => {
      nowPlayingMediaPromise = null
      throw error
    })
  }

  return nowPlayingMediaPromise
}

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

let classicMediaPromise: Promise<ClassicMedia> | null = null

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

export function getClassicMedia(): Promise<ClassicMedia> {
  if (!classicMediaPromise) {
    classicMediaPromise = loadClassicMedia().catch((error: unknown) => {
      classicMediaPromise = null
      throw error
    })
  }

  return classicMediaPromise
}