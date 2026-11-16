import { applyFilters, baselineFilters, GENRES, withoutGenres } from '@/api/filters'
import {
  getJson,
  toPopularMediaItem,
  type MediaKind,
  type TmdbTrendingItem,
} from '@/api/tmdb'
import { titleKey } from '@/lib/library'
import { REC } from './config'
import { favouriteActors, topFeatures, type TasteProfile } from './profile'
import type { Candidate } from './scoring'

/** One TMDB source that feeds the pool. Each call to `fetchPage(page)` gives the next page of it. */
export type Query = {
  id: string
  kind: MediaKind | 'mixed'
  role: 'seed' | 'discover' | 'explore' | 'base'
  /** Seed queries: how much the title they came from is liked. */
  seedWeight?: number
  /** Discover queries built from keywords / people: how strong that taste is (0–1). */
  evidence?: number
  /** Higher-priority sources are fetched first when the pool needs more titles. */
  priority: number
  maxPages: number
  fetchPage: (page: number) => Promise<QueryPage>
}

const PRIORITY = {
  actor: 92,
  seed: 90,
  people: 80,
  keyword: 70,
  genre: 60,
  genreTop: 58,
  coldTop: 60,
  coldPopular: 55,
  trending: 30,
  explore: 20,
} as const

type TmdbPage = { results: TmdbTrendingItem[]; total_pages?: number }
type TmdbCredit = TmdbTrendingItem & { character?: string }

export type QueryPage = {
  results: TmdbTrendingItem[]
  /** The last page TMDB reports; single-response sources (person credits) have just one. */
  totalPages: number
}

const tmdbKind = (kind: MediaKind) => (kind === 'movie' ? 'movie' : 'tv')
const KINDS: MediaKind[] = ['movie', 'series']

async function listPage(path: string): Promise<QueryPage> {
  const response = await getJson<TmdbPage>(path)
  return { results: response.results, totalPages: response.total_pages ?? 1 }
}

// "Self", "Himself (archive footage)" and the like: the actor plays no real role in the title.
const SELF_ROLE = /^(self|himself|herself|themselves)\b/i
const ARCHIVE_FOOTAGE = /archive footage/i

/**
 * An actor's whole filmography in one response. It covers movies and series alike, which the
 * TV discover endpoint cannot do with `with_people`, so a recurring actor is followed this way.
 */
async function personCreditsPage(personId: number): Promise<QueryPage> {
  const response = await getJson<{ cast?: TmdbCredit[] }>(
    `/person/${personId}/combined_credits?language=en-US`,
  )

  const seen = new Set<string>()
  const results: TmdbTrendingItem[] = []

  for (const credit of response.cast ?? []) {
    if (credit.media_type !== 'movie' && credit.media_type !== 'tv') continue

    const role = credit.character?.trim() ?? ''
    if (ARCHIVE_FOOTAGE.test(role)) continue
    if (credit.media_type === 'tv' && SELF_ROLE.test(role)) continue

    const key = `${credit.media_type}-${credit.id}`
    if (seen.has(key)) continue
    seen.add(key)
    results.push(credit)
  }

  return {
    results: results
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
      .slice(0, REC.cast.creditLimit),
    totalPages: 1,
  }
}

// Discover queries only ask for titles with a real audience; the app-wide filters run after.
// TMDB rejects a repeated parameter with a 400, so the default vote floor is added only when
// the query does not set its own.
const discover = (kind: MediaKind, params: string, page: number) => {
  const votes = params.includes('vote_count.gte=') ? '' : '&vote_count.gte=150'
  return `/discover/${tmdbKind(kind)}?language=en-US${votes}&${params}&page=${page}`
}

/** Personalised plan: what to ask TMDB for, built from the taste profile. */
export function buildPlan(profile: TasteProfile): Query[] {
  const queries: Query[] = []

  // 1. "People who liked X also liked": TMDB's own collaborative signal for the user's favourites.
  for (const { ref, weight } of profile.seeds) {
    queries.push({
      id: `rec:${titleKey(ref)}`,
      kind: ref.kind,
      role: 'seed',
      seedWeight: weight,
      priority: PRIORITY.seed + weight * 10,
      maxPages: REC.recommendationPages,
      fetchPage: (page) =>
        listPage(`/${tmdbKind(ref.kind)}/${ref.id}/recommendations?language=en-US&page=${page}`),
    })
  }

  const genres = topFeatures(profile.genres, null, 5)
  const keywords = topFeatures(profile.keywords, profile.keywordCounts, 3, 2)
  const people = topFeatures(profile.people, profile.peopleCounts, 3, 2)
  const actors = favouriteActors(profile)

  const keywordEvidence = evidenceOf(profile.keywords, keywords)
  const peopleEvidence = evidenceOf(profile.people, people)

  for (const kind of KINDS) {
    // 2. Discover by the strongest genres: the popular ones, and the best-rated ones.
    if (genres.length >= 2) {
      queries.push({
        id: `genres-pop:${kind}`,
        kind,
        role: 'discover',
        priority: PRIORITY.genre,
        maxPages: REC.maxPagesPerQuery,
        fetchPage: (page) =>
          listPage(
            discover(
              kind,
              `sort_by=popularity.desc&with_genres=${genres.slice(0, 2).join(',')}`,
              page,
            ),
          ),
      })
    }

    if (genres.length >= 1) {
      queries.push({
        id: `genres-top:${kind}`,
        kind,
        role: 'discover',
        priority: PRIORITY.genreTop,
        maxPages: REC.maxPagesPerQuery,
        fetchPage: (page) =>
          listPage(
            discover(
              kind,
              `sort_by=vote_average.desc&vote_count.gte=500&with_genres=${genres.slice(0, 3).join('|')}`,
              page,
            ),
          ),
      })
    }

    // 3. Discover by recurring keywords (themes) in the user's favourites.
    if (keywords.length > 0) {
      queries.push({
        id: `keywords:${kind}`,
        kind,
        role: 'discover',
        evidence: keywordEvidence,
        priority: PRIORITY.keyword,
        maxPages: REC.maxPagesPerQuery,
        fetchPage: (page) =>
          listPage(
            discover(kind, `sort_by=popularity.desc&with_keywords=${keywords.join('|')}`, page),
          ),
      })
    }
  }

  // 4. Favourite directors and actors (TMDB only supports `with_people` for movies).
  if (people.length > 0) {
    queries.push({
      id: 'people:movie',
      kind: 'movie',
      role: 'discover',
      evidence: peopleEvidence,
      priority: PRIORITY.people,
      maxPages: REC.maxPagesPerQuery,
      fetchPage: (page) =>
        listPage(
          discover('movie', `sort_by=popularity.desc&with_people=${people.join('|')}`, page),
        ),
    })
  }

  // 5. Actors who keep appearing in liked titles get one query each. Their credits cover both
  //    movies and series, so a familiar face can pull a title in even when genres do not match.
  for (const actor of actors) {
    const evidence = actorEvidence(profile, actor)

    queries.push({
      id: `actor:${actor}`,
      kind: 'mixed',
      role: 'discover',
      evidence,
      priority: PRIORITY.actor + evidence * 8,
      maxPages: 1,
      fetchPage: () => personCreditsPage(actor),
    })
  }

  // 6. Exploration: the week's trending titles and the next-best genres.
  queries.push(trending())

  const adjacent = genres.slice(2, 5)
  if (adjacent.length > 0) {
    for (const kind of KINDS) {
      queries.push({
        id: `adjacent:${kind}`,
        kind,
        role: 'explore',
        priority: PRIORITY.explore,
        maxPages: REC.maxPagesPerQuery,
        fetchPage: (page) =>
          listPage(discover(kind, `sort_by=popularity.desc&with_genres=${adjacent.join('|')}`, page)),
      })
    }
  }

  return queries
}

/** Plan for a user with (almost) no history: well-liked, popular titles of every kind. */
export function buildColdPlan(): Query[] {
  const plan: Query[] = [trending()]

  for (const kind of KINDS) {
    plan.push({
      id: `cold-top:${kind}`,
      kind,
      role: 'base',
      priority: PRIORITY.coldTop,
      maxPages: REC.maxPagesPerQuery,
      fetchPage: (page) =>
        listPage(
          discover(
            kind,
            `sort_by=vote_average.desc&vote_count.gte=${kind === 'movie' ? 2000 : 800}`,
            page,
          ),
        ),
    })
    plan.push({
      id: `cold-pop:${kind}`,
      kind,
      role: 'base',
      priority: PRIORITY.coldPopular,
      maxPages: REC.maxPagesPerQuery,
      fetchPage: (page) => listPage(discover(kind, 'sort_by=popularity.desc', page)),
    })
  }

  return plan
}

function trending(): Query {
  return {
    id: 'trending',
    kind: 'mixed',
    role: 'explore',
    priority: PRIORITY.trending,
    maxPages: REC.maxPagesPerQuery,
    fetchPage: (page) => listPage(`/trending/all/week?language=en-US&page=${page}`),
  }
}

/** How strongly a recurring actor points at their other titles (recurrence adds to affinity). */
function actorEvidence(profile: TasteProfile, actor: number): number {
  const affinity = profile.cast.get(actor) ?? 0
  const count = profile.castCounts.get(actor) ?? 0

  return Math.min(1, Math.max(0, affinity) * 2 + Math.min(count, 5) * 0.06)
}

function evidenceOf(affinity: Map<number, number>, ids: number[]): number {
  if (ids.length === 0) return 0
  const mean = ids.reduce((sum, id) => sum + (affinity.get(id) ?? 0), 0) / ids.length
  return Math.min(1, mean * 2)
}

const gate = [...baselineFilters, withoutGenres(GENRES.talkShow, GENRES.news)]

export type PageResult = { candidates: Candidate[]; hasMorePages: boolean }

/** Loads one page of a query and turns the titles that pass the app-wide quality gate into candidates. */
export async function fetchQueryPage(query: Query, page: number): Promise<PageResult> {
  const response = await query.fetchPage(page)

  const candidates = applyFilters(response.results, gate).flatMap((raw) => {
    const kind = resolveKind(query, raw)
    if (!kind) return []

    const item = toPopularMediaItem(raw, kind)
    if (!item) return []

    const candidate: Candidate = {
      key: titleKey({ kind, id: raw.id }),
      kind,
      item,
      genreIds: raw.genre_ids ?? [],
      language: raw.original_language ?? '',
      year: Number(item.year) || 0,
      votes: raw.vote_count,
      rating: raw.vote_average,
      popularity: raw.popularity,
      seedSupport: query.role === 'seed' ? (query.seedWeight ?? 0) : 0,
      evidence: query.evidence ?? 0,
      roles: new Set([query.role]),
    }

    return [candidate]
  })

  return {
    candidates,
    hasMorePages: page < Math.min(response.totalPages, query.maxPages),
  }
}

function resolveKind(query: Query, raw: TmdbTrendingItem): MediaKind | null {
  if (query.kind !== 'mixed') return query.kind
  if (raw.media_type === 'movie') return 'movie'
  if (raw.media_type === 'tv') return 'series'
  return null
}
