import { applyFilters, baselineFilters, GENRES, withoutGenres } from '@/api/filters'
import {
  getJson,
  toPopularMediaItem,
  type MediaKind,
  type TmdbTrendingItem,
} from '@/api/tmdb'
import { titleKey } from '@/lib/library'
import { REC } from './config'
import { topFeatures, type TasteProfile } from './profile'
import type { Candidate } from './scoring'

/** One TMDB list that feeds the pool. Each call to `path(page)` gives the next page of it. */
export type Query = {
  id: string
  path: (page: number) => string
  /** `mixed` lists (trending) carry `media_type` on every item. */
  kind: MediaKind | 'mixed'
  role: 'seed' | 'discover' | 'explore' | 'base'
  /** Seed queries: how much the title they came from is liked. */
  seedWeight?: number
  /** Discover queries built from keywords / people: how strong that taste is (0–1). */
  evidence?: number
  maxPages: number
}

type TmdbPage = { results: TmdbTrendingItem[]; total_pages?: number }

const tmdbKind = (kind: MediaKind) => (kind === 'movie' ? 'movie' : 'tv')
const KINDS: MediaKind[] = ['movie', 'series']

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
      maxPages: REC.recommendationPages,
      path: (page) =>
        `/${tmdbKind(ref.kind)}/${ref.id}/recommendations?language=en-US&page=${page}`,
    })
  }

  const genres = topFeatures(profile.genres, null, 5)
  const keywords = topFeatures(profile.keywords, profile.keywordCounts, 3, 2)
  const people = topFeatures(profile.people, profile.peopleCounts, 3, 2)

  const keywordEvidence = evidenceOf(profile.keywords, keywords)
  const peopleEvidence = evidenceOf(profile.people, people)

  for (const kind of KINDS) {
    // 2. Discover by the strongest genres: the popular ones, and the best-rated ones.
    if (genres.length >= 2) {
      queries.push({
        id: `genres-pop:${kind}`,
        kind,
        role: 'discover',
        maxPages: REC.maxPagesPerQuery,
        path: (page) =>
          discover(kind, `sort_by=popularity.desc&with_genres=${genres.slice(0, 2).join(',')}`, page),
      })
    }

    if (genres.length >= 1) {
      queries.push({
        id: `genres-top:${kind}`,
        kind,
        role: 'discover',
        maxPages: REC.maxPagesPerQuery,
        path: (page) =>
          discover(
            kind,
            `sort_by=vote_average.desc&vote_count.gte=500&with_genres=${genres.slice(0, 3).join('|')}`,
            page,
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
        maxPages: REC.maxPagesPerQuery,
        path: (page) =>
          discover(kind, `sort_by=popularity.desc&with_keywords=${keywords.join('|')}`, page),
      })
    }
  }

  // 4. Favourite directors and actors (TMDB only supports this for movies).
  if (people.length > 0) {
    queries.push({
      id: 'people:movie',
      kind: 'movie',
      role: 'discover',
      evidence: peopleEvidence,
      maxPages: REC.maxPagesPerQuery,
      path: (page) => discover('movie', `sort_by=popularity.desc&with_people=${people.join('|')}`, page),
    })
  }

  // 5. Exploration: the week's trending titles and the next-best genres.
  queries.push(trending())

  const adjacent = genres.slice(2, 5)
  if (adjacent.length > 0) {
    for (const kind of KINDS) {
      queries.push({
        id: `adjacent:${kind}`,
        kind,
        role: 'explore',
        maxPages: REC.maxPagesPerQuery,
        path: (page) =>
          discover(kind, `sort_by=popularity.desc&with_genres=${adjacent.join('|')}`, page),
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
      maxPages: REC.maxPagesPerQuery,
      path: (page) =>
        discover(kind, `sort_by=vote_average.desc&vote_count.gte=${kind === 'movie' ? 2000 : 800}`, page),
    })
    plan.push({
      id: `cold-pop:${kind}`,
      kind,
      role: 'base',
      maxPages: REC.maxPagesPerQuery,
      path: (page) => discover(kind, 'sort_by=popularity.desc', page),
    })
  }

  return plan
}

function trending(): Query {
  return {
    id: 'trending',
    kind: 'mixed',
    role: 'explore',
    maxPages: REC.maxPagesPerQuery,
    path: (page) => `/trending/all/week?language=en-US&page=${page}`,
  }
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
  const response = await getJson<TmdbPage>(query.path(page))

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

  const totalPages = response.total_pages ?? page
  return { candidates, hasMorePages: page < Math.min(totalPages, query.maxPages) }
}

function resolveKind(query: Query, raw: TmdbTrendingItem): MediaKind | null {
  if (query.kind !== 'mixed') return query.kind
  if (raw.media_type === 'movie') return 'movie'
  if (raw.media_type === 'tv') return 'series'
  return null
}
