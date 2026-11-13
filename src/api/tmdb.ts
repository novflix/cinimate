import {
  applyFilters,
  GENRES,
  genreQuery,
  withoutGenres,
  type MediaFilter,
} from '@/api/filters'

const API_ROOT = 'https://api.themoviedb.org/3'
const IMAGE_ROOT = 'https://image.tmdb.org/t/p'

const HERO_SLIDE_COUNT = 12

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
    withoutGenres(GENRES.talkShow, GENRES.news),
  ])
    .filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
    .filter((item) => item.vote_count > 0 && item.vote_average > 0)
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

async function loadPopularList(
  path: string,
  kind: MediaKind,
  filters: MediaFilter[] = [],
): Promise<PopularMediaItem[]> {
  const separator = path.includes('?') ? '&' : '?'
  const list = await getJson<TmdbList<TmdbTrendingItem>>(
    `${path}${separator}language=en-US&page=1`,
  )

  return applyFilters(list.results, filters).flatMap((item) => {
    const media = toPopularMediaItem(item, kind)
    return media ? [media] : []
  })
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
      .slice(0, 20),
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