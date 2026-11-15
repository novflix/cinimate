import { GENRES } from '@/api/filters'
import { createResource, type Resource } from '@/api/resource'
import {
  getJson,
  toPopularMediaItem,
  type MediaKind,
  type PopularMediaItem,
  type TmdbTrendingItem,
} from '@/api/tmdb'

type TmdbCredit = TmdbTrendingItem & {
  character?: string
  job?: string
}

type TmdbPersonDetails = {
  id: number
  name: string
  adult?: boolean
  biography?: string
  birthday?: string | null
  deathday?: string | null
  place_of_birth?: string | null
  profile_path: string | null
  known_for_department?: string
  combined_credits?: { cast?: TmdbCredit[]; crew?: TmdbCredit[] }
}

export type PersonDetails = {
  id: number
  name: string
  /** What the person is known for: `Acting`, `Directing`, `Writing`... Empty when unknown. */
  department: string
  /** `YYYY-MM-DD`, or an empty string when unknown. */
  birthday: string
  /** `YYYY-MM-DD`, or an empty string while the person is alive or the date is unknown. */
  deathday: string
  birthplace: string
  biography: string
  photo: string | null
  /** Every movie and series the person worked on, the most popular first. */
  filmography: PopularMediaItem[]
  movies: number
  series: number
  tmdbUrl: string
}

// Talk shows and news are full of guest appearances, which are not a real filmography.
const EXCLUDED_GENRES: readonly number[] = [GENRES.talkShow, GENRES.news]

// "Self", "Himself (archive footage)" and the like: the person plays no role in the title.
const SELF_ROLE = /^(self|himself|herself|themselves)\b/i
const ARCHIVE_FOOTAGE = /archive footage/i

function isGuestAppearance(credit: TmdbCredit): boolean {
  const role = credit.character?.trim() ?? ''

  if (ARCHIVE_FOOTAGE.test(role)) return true
  return credit.media_type === 'tv' && SELF_ROLE.test(role)
}

function buildFilmography(data: TmdbPersonDetails): PopularMediaItem[] {
  const credits = [...(data.combined_credits?.cast ?? []), ...(data.combined_credits?.crew ?? [])]
  const titles = new Map<string, PopularMediaItem>()

  for (const credit of credits) {
    if (credit.media_type !== 'movie' && credit.media_type !== 'tv') continue
    if (credit.genre_ids?.some((genre) => EXCLUDED_GENRES.includes(genre))) continue
    if (isGuestAppearance(credit)) continue

    const kind: MediaKind = credit.media_type === 'movie' ? 'movie' : 'series'
    const key = `${kind}-${credit.id}`
    // A person is often listed several times for one title (acting and producing, say).
    if (titles.has(key)) continue

    const media = toPopularMediaItem(credit, kind)
    if (media) titles.set(key, media)
  }

  return [...titles.values()].sort((a, b) => b.popularity - a.popularity)
}

function toPersonDetails(data: TmdbPersonDetails): PersonDetails {
  const filmography = buildFilmography(data)
  const movies = filmography.filter((item) => item.kind === 'movie').length

  return {
    id: data.id,
    name: data.name,
    department: data.known_for_department ?? '',
    birthday: data.birthday ?? '',
    deathday: data.deathday ?? '',
    birthplace: data.place_of_birth ?? '',
    biography: (data.biography ?? '').trim(),
    photo: data.profile_path,
    filmography,
    movies,
    series: filmography.length - movies,
    tmdbUrl: `https://www.themoviedb.org/person/${data.id}`,
  }
}

const PERSON_DETAILS_STALE_TIME = 30 * 60_000

const personDetailsResources = new Map<number, Resource<PersonDetails>>()

/** One resource per person, so a page visited before opens instantly. */
export function personDetailsResource(id: number): Resource<PersonDetails> {
  const cached = personDetailsResources.get(id)
  if (cached) return cached

  const resource = createResource(() => loadPersonDetails(id), {
    staleTime: PERSON_DETAILS_STALE_TIME,
  })

  // Keep the cache bounded during a long session; the oldest people are dropped first.
  if (personDetailsResources.size >= 80) {
    const oldest = personDetailsResources.keys().next().value
    if (oldest !== undefined) personDetailsResources.delete(oldest)
  }

  personDetailsResources.set(id, resource)
  return resource
}

/** One request: the credits are appended to the person. */
async function loadPersonDetails(id: number): Promise<PersonDetails> {
  const data = await getJson<TmdbPersonDetails>(
    `/person/${id}?language=en-US&append_to_response=combined_credits`,
  )

  return toPersonDetails(data)
}

/** `1 movie`, `14 movies`. */
export function formatMovieCount(count: number): string {
  return `${count} ${count === 1 ? 'movie' : 'movies'}`
}

/** `1 series`, `8 series`: the word does not change. */
export function formatSeriesCount(count: number): string {
  return `${count} series`
}