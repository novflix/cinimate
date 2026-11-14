import { applyFilters, baselineFilters } from '@/api/filters'
import { createResource, type Resource } from '@/api/resource'
import {
  getJson,
  parseIsoDate,
  toPopularMediaItem,
  type MediaKind,
  type PopularMediaItem,
  type TmdbTrendingItem,
} from '@/api/tmdb'

const CAST_LIMIT = 20
const CREW_LIMIT = 12
const SIMILAR_LIMIT = 20

// Crew shown on a title page, most important first. A person with several of these jobs is
// shown once, with their two most important jobs as the role.
const CREW_JOBS: readonly string[] = [
  'Creator',
  'Director',
  'Screenplay',
  'Writer',
  'Story',
  'Producer',
  'Executive Producer',
  'Original Music Composer',
  'Director of Photography',
]

type TmdbPerson = {
  id: number
  name: string
  profile_path: string | null
  character?: string
  job?: string
  order?: number
}

type TmdbDetails = TmdbTrendingItem & {
  original_language?: string
  status?: string
  runtime?: number | null
  episode_run_time?: number[]
  last_episode_to_air?: { runtime?: number | null } | null
  budget?: number
  revenue?: number
  number_of_seasons?: number
  number_of_episodes?: number
  created_by?: TmdbPerson[]
  credits?: { cast?: TmdbPerson[]; crew?: TmdbPerson[] }
  release_dates?: {
    results?: { iso_3166_1: string; release_dates: { certification: string }[] }[]
  }
  content_ratings?: { results?: { iso_3166_1: string; rating: string }[] }
  recommendations?: { results?: TmdbTrendingItem[] }
  similar?: { results?: TmdbTrendingItem[] }
}

export type TitlePerson = {
  id: number
  name: string
  role: string
  photo: string | null
}

export type TitleDetails = {
  id: number
  kind: MediaKind
  title: string
  overview: string
  backdrop: string | null
  poster: string | null
  rating: number
  votes: number
  year: string
  /** `YYYY-MM-DD`, or an empty string when unknown. */
  releaseDate: string
  /** Minutes; the length of one episode for a series. */
  runtime: number | null
  certification: string | null
  status: string
  language: string
  budget: number
  revenue: number
  seasons: number | null
  episodes: number | null
  cast: TitlePerson[]
  crew: TitlePerson[]
  similar: PopularMediaItem[]
  tmdbUrl: string
}

function certificationOf(data: TmdbDetails, kind: MediaKind): string | null {
  if (kind === 'movie') {
    const countries = data.release_dates?.results ?? []
    const pick = (country?: { release_dates: { certification: string }[] }) =>
      country?.release_dates.find((release) => release.certification)?.certification ?? null

    return (
      pick(countries.find((country) => country.iso_3166_1 === 'US')) ??
      countries.map((country) => pick(country)).find(Boolean) ??
      null
    )
  }

  const ratings = data.content_ratings?.results ?? []

  return (
    ratings.find((entry) => entry.iso_3166_1 === 'US')?.rating ||
    ratings.find((entry) => entry.rating)?.rating ||
    null
  )
}

function pickCast(cast: TmdbPerson[]): TitlePerson[] {
  return cast
    .filter((person) => person.profile_path)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .slice(0, CAST_LIMIT)
    .map((person) => ({
      id: person.id,
      name: person.name,
      role: person.character ?? '',
      photo: person.profile_path,
    }))
}

function pickCrew(crew: TmdbPerson[], creators: TmdbPerson[]): TitlePerson[] {
  const people = new Map<number, { person: TmdbPerson; jobs: string[] }>()

  const add = (person: TmdbPerson, job: string) => {
    if (!person.profile_path) return

    const entry = people.get(person.id) ?? { person, jobs: [] }
    if (!entry.jobs.includes(job)) entry.jobs.push(job)
    people.set(person.id, entry)
  }

  creators.forEach((person) => add(person, 'Creator'))
  crew.forEach((person) => {
    if (person.job && CREW_JOBS.includes(person.job)) add(person, person.job)
  })

  const rank = (job: string) => CREW_JOBS.indexOf(job)

  return [...people.values()]
    .map((entry) => ({ ...entry, jobs: [...entry.jobs].sort((a, b) => rank(a) - rank(b)) }))
    .sort((a, b) => rank(a.jobs[0] ?? '') - rank(b.jobs[0] ?? ''))
    .slice(0, CREW_LIMIT)
    .map(({ person, jobs }) => ({
      id: person.id,
      name: person.name,
      role: jobs.slice(0, 2).join(', '),
      photo: person.profile_path,
    }))
}

// Recommendations are better than TMDB's genre-based "similar", so they go first. Everything
// passes the same quality gate as the lists on the home page.
function pickSimilar(data: TmdbDetails, kind: MediaKind): PopularMediaItem[] {
  const candidates = [
    ...(data.recommendations?.results ?? []),
    ...(data.similar?.results ?? []),
  ].filter((item) => item.id !== data.id)

  const seen = new Set<number>()

  return applyFilters(candidates, baselineFilters)
    .flatMap((item) => {
      if (seen.has(item.id)) return []
      seen.add(item.id)

      const media = toPopularMediaItem(item, kind)
      return media ? [media] : []
    })
    .slice(0, SIMILAR_LIMIT)
}

function toTitleDetails(data: TmdbDetails, kind: MediaKind): TitleDetails {
  const isMovie = kind === 'movie'
  const date = (isMovie ? data.release_date : data.first_air_date) ?? ''
  const runtime = isMovie
    ? data.runtime
    : (data.episode_run_time?.[0] ?? data.last_episode_to_air?.runtime)

  return {
    id: data.id,
    kind,
    title: (isMovie ? data.title : data.name) ?? '',
    overview: data.overview ?? '',
    backdrop: data.backdrop_path,
    poster: data.poster_path,
    rating: data.vote_average,
    votes: data.vote_count,
    year: date.slice(0, 4),
    releaseDate: date,
    runtime: runtime || null,
    certification: certificationOf(data, kind),
    status: data.status ?? '',
    language: data.original_language ?? '',
    budget: data.budget ?? 0,
    revenue: data.revenue ?? 0,
    seasons: data.number_of_seasons ?? null,
    episodes: data.number_of_episodes ?? null,
    cast: pickCast(data.credits?.cast ?? []),
    crew: pickCrew(data.credits?.crew ?? [], data.created_by ?? []),
    similar: pickSimilar(data, kind),
    tmdbUrl: `https://www.themoviedb.org/${isMovie ? 'movie' : 'tv'}/${data.id}`,
  }
}

const TITLE_DETAILS_STALE_TIME = 30 * 60_000

const titleDetailsResources = new Map<string, Resource<TitleDetails>>()

/** One resource per title, so a page visited before (or preloaded on hover) opens instantly. */
export function titleDetailsResource(kind: MediaKind, id: number): Resource<TitleDetails> {
  const key = `${kind}-${id}`
  const cached = titleDetailsResources.get(key)
  if (cached) return cached

  const resource = createResource(() => loadTitleDetails(kind, id), {
    staleTime: TITLE_DETAILS_STALE_TIME,
  })

  // Keep the cache bounded during a long session; the oldest titles are dropped first.
  if (titleDetailsResources.size >= 80) {
    const oldest = titleDetailsResources.keys().next().value
    if (oldest) titleDetailsResources.delete(oldest)
  }

  titleDetailsResources.set(key, resource)
  return resource
}

/** One request: details, credits, age rating and recommendations are appended to it. */
async function loadTitleDetails(kind: MediaKind, id: number): Promise<TitleDetails> {
  const path =
    kind === 'movie'
      ? `/movie/${id}?language=en-US&append_to_response=credits,release_dates,recommendations,similar`
      : `/tv/${id}?language=en-US&append_to_response=credits,content_ratings,recommendations,similar`

  const data = await getJson<TmdbDetails>(path)
  return toTitleDetails(data, kind)
}

export function getTitleDetails(kind: MediaKind, id: number): Promise<TitleDetails> {
  return titleDetailsResource(kind, id).get()
}

export function prefetchTitleDetails(kind: MediaKind, id: number): Promise<void> {
  return titleDetailsResource(kind, id).prefetch()
}

/** 102 → `1h 42m`, 45 → `45m`. */
export function formatRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60

  if (hours === 0) return `${rest}m`
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}

/** 78000000 → `$78.0M`; zero means TMDB has no figure. */
export function formatMoney(value: number): string {
  if (!value) return '—'
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`
  return `$${value}`
}

/** `2024-09-12` → `September 12, 2024`. */
export function formatFullDate(date: string): string {
  if (!date) return '—'

  return parseIsoDate(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/** 6335 → `6,335 votes`. */
export function formatVoteCount(votes: number): string {
  if (!votes) return '—'
  return `${votes.toLocaleString('en-US')} ${votes === 1 ? 'vote' : 'votes'}`
}

/** `en` → `English`. */
export function languageName(code: string): string {
  if (!code || code === 'xx') return '—'

  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ?? code
  } catch {
    return code
  }
}