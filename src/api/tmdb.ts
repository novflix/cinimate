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

  return trending.results
    .filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
    .filter((item) => item.vote_count > 0 && item.vote_average > 0)
    .filter(
      (item) => !item.genre_ids?.includes(10767) && !item.genre_ids?.includes(10763),
    )
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
