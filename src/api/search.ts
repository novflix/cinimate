import { QUALITY } from '@/api/filters'
import {
  detectGenre,
  fallbackVariants,
  fold,
  hasCyrillic,
  matchOverview,
  matchTitle,
  MATCH_WEIGHTS,
  primaryVariants,
  type GenreEntry,
  type MatchKind,
  type TextMatch,
} from '@/api/searchText'
import { getJson, type MediaKind, type TmdbTrendingItem } from '@/api/tmdb'

const RESULT_LIMIT = 40
const CREDITS_PERSON_LIMIT = 3
const POOL_MATCH_LIMIT = 12
const SEARCH_CACHE_TTL = 10 * 60_000
const SEARCH_CACHE_LIMIT = 30
const POOL_CACHE_TTL = 5 * 60_000
const SERVER_MATCH_BASE = MATCH_WEIGHTS.server

type TmdbSearchItem = TmdbTrendingItem & {
  media_type?: 'movie' | 'tv' | 'person'
  original_title?: string
  original_name?: string
}

type TmdbList<T> = {
  results: T[]
}

type TmdbPerson = {
  id: number
  name: string
  original_name?: string
  popularity?: number
}

type TmdbCombinedCredits = {
  cast?: (TmdbSearchItem & { character?: string })[]
  crew?: (TmdbSearchItem & { job?: string })[]
}

type TmdbKeyword = {
  id: number
  name: string
}

export type SearchResult = {
  id: number
  kind: MediaKind
  title: string
  year: string
  rating: number
  votes: number
  releaseDate: string
  overview: string
  poster: string | null
  backdrop: string | null
  popularity: number
  /** Base relevance, before any popularity tie-break. */
  score: number
  match: MatchKind
  /** Human-readable hint such as "Starring Tom Hanks"; `null` for a plain title match. */
  matchLabel: string | null
}

type Scored = {
  item: TmdbSearchItem
  kind: MediaKind
  score: number
  match: MatchKind
  detail?: string
  /** How many independent signals found the same title (title + actor + genre…). */
  extraMatches: number
  popularity: number
}

type ScoreOptions = {
  /** Weakest acceptable signal for this source, e.g. actor → 55, genre → 35. */
  floor?: { score: number; kind: MatchKind; detail?: string }
  /** Position in a TMDB search response; used when the API matched an alias our text can't read. */
  serverRank?: number
  strict?: boolean
}

function kindOf(item: TmdbSearchItem, fallback: MediaKind | null = null): MediaKind | null {
  if (item.media_type === 'movie') return 'movie'
  if (item.media_type === 'tv') return 'series'
  return fallback
}

function titleOf(item: TmdbSearchItem, kind: MediaKind): string {
  return (kind === 'movie' ? item.title : item.name) ?? ''
}

function originalOf(item: TmdbSearchItem, kind: MediaKind): string {
  return (kind === 'movie' ? item.original_title : item.original_name) ?? ''
}

function dateOf(item: TmdbSearchItem, kind: MediaKind): string {
  return (kind === 'movie' ? item.release_date : item.first_air_date) ?? ''
}

/** Russian catalogue titles are swapped for their English original when the app has one. */
function displayTitle(item: TmdbSearchItem, kind: MediaKind): string {
  const title = titleOf(item, kind)
  const original = originalOf(item, kind)

  if (
    title &&
    original &&
    item.original_language === 'en' &&
    hasCyrillic(title) &&
    !hasCyrillic(original)
  ) {
    return original
  }

  return title || original
}

function passesGate(item: TmdbSearchItem, kind: MediaKind, strict: boolean): boolean {
  if (item.adult) return false
  if (!item.poster_path && !item.backdrop_path) return false

  const votes = item.vote_count ?? 0

  if (strict) {
    if (votes < QUALITY.minVotes) return false
    if ((item.vote_average ?? 0) < QUALITY.minRating) return false
    if (!item.overview?.trim()) return false
  }

  // A title with no votes is still a valid result when it has not come out yet.
  if (votes === 0 && !dateOf(item, kind)) return false

  return true
}

/** The strongest text match for a title: display title, original title (alias) or description. */
function bestTextMatch(query: string, item: TmdbSearchItem, kind: MediaKind): TextMatch | null {
  const title = titleOf(item, kind)
  const original = originalOf(item, kind)

  const primary = matchTitle(query, title)
  const alias = original && original !== title ? matchTitle(query, original) : null

  if (!primary && !alias) {
    return item.overview ? matchOverview(query, item.overview) : null
  }

  if (!primary) {
    return { score: Math.min(MATCH_WEIGHTS['alt-title'], alias?.score ?? 0), kind: 'alt-title' }
  }

  if (alias && alias.score >= 60 && alias.score > primary.score) {
    return { score: Math.min(MATCH_WEIGHTS['alt-title'], alias.score), kind: 'alt-title' }
  }

  return primary
}

function serverScore(rank: number): number {
  // The API's own ranking is a fallback only: it explains matches our folded text cannot see
  // (translated and alternative titles) without ever beating a direct title match.
  return Math.max(45, SERVER_MATCH_BASE - rank * 1.5)
}

function scoreItem(
  query: string,
  item: TmdbSearchItem,
  kind: MediaKind,
  options: ScoreOptions = {},
): Scored | null {
  if (!passesGate(item, kind, options.strict ?? false)) return null

  const text = bestTextMatch(query, item, kind)
  let floor = options.floor

  if (options.serverRank !== undefined) {
    const server = { score: serverScore(options.serverRank), kind: 'server' as const }
    if (!floor || server.score > floor.score) floor = server
  }

  let best: { score: number; kind: MatchKind; detail?: string } | null = null

  if (text && floor) {
    best = text.score >= floor.score ? text : floor
  } else {
    best = text ?? floor ?? null
  }

  if (!best) return null

  return {
    item,
    kind,
    score: best.score,
    match: best.kind,
    detail: best.detail,
    extraMatches: 0,
    popularity: item.popularity ?? 0,
  }
}

function addScored(collected: Map<string, Scored>, next: Scored): void {
  const key = `${next.kind}-${next.item.id}`
  const previous = collected.get(key)

  if (!previous) {
    collected.set(key, next)
    return
  }

  const extraMatches =
    Math.max(previous.extraMatches, next.extraMatches) +
    (previous.match !== next.match ? 1 : 0)

  const winner = next.score > previous.score + 0.01 ? next : previous
  collected.set(key, { ...winner, extraMatches: Math.min(extraMatches, 2) })
}

function matchLabel(scored: Scored): string | null {
  switch (scored.match) {
    case 'actor':
      return scored.detail ? `Starring ${scored.detail}` : 'Actor match'
    case 'director':
      return scored.detail ? `Directed by ${scored.detail}` : 'Director match'
    case 'genre':
      return scored.detail ? `Genre: ${scored.detail}` : 'Genre match'
    case 'keyword':
      return scored.detail ? `Keyword: ${scored.detail}` : 'Keyword match'
    case 'overview':
      return 'Description match'
    case 'fuzzy':
      return 'Close match'
    case 'alt-title':
      return 'Alternative title'
    default:
      return null
  }
}

function toSearchResult(scored: Scored): SearchResult {
  const { item, kind } = scored
  const date = dateOf(item, kind)

  return {
    id: item.id,
    kind,
    title: displayTitle(item, kind),
    year: date.slice(0, 4),
    rating: item.vote_average ?? 0,
    votes: item.vote_count ?? 0,
    releaseDate: date,
    overview: item.overview ?? '',
    poster: item.poster_path,
    backdrop: item.backdrop_path,
    popularity: item.popularity ?? 0,
    score: Math.round(scored.score * 10) / 10,
    match: scored.match,
    matchLabel: matchLabel(scored),
  }
}

function finalize(collected: Map<string, Scored>): SearchResult[] {
  return [...collected.values()]
    .map((scored) => {
      // Extra independent signals nudge a result up within its tier, never across a whole tier.
      const relevance = scored.score + scored.extraMatches * 2
      // Popularity breaks ties only: its maximum influence is below one relevance point.
      const popularity = (Math.min(scored.popularity, 3000) / 3000) * 0.9

      return { scored, order: relevance + popularity }
    })
    .sort(
      (a, b) =>
        b.order - a.order || (b.scored.item.vote_count ?? 0) - (a.scored.item.vote_count ?? 0),
    )
    .slice(0, RESULT_LIMIT)
    .map(({ scored }) => toSearchResult(scored))
}

async function fetchMulti(variant: string): Promise<TmdbSearchItem[]> {
  const response = await getJson<TmdbList<TmdbSearchItem>>(
    `/search/multi?query=${encodeURIComponent(variant)}&language=en-US&page=1&include_adult=false`,
  )

  return response.results
}

async function fetchPeople(variant: string, language: string): Promise<TmdbPerson[]> {
  const response = await getJson<TmdbList<TmdbPerson>>(
    `/search/person?query=${encodeURIComponent(variant)}&language=${language}&page=1&include_adult=false`,
  )

  return response.results
}

function personMatch(query: string, person: TmdbPerson): number {
  const localized = matchTitle(query, person.name)?.score ?? 0
  const original = person.original_name ? matchTitle(query, person.original_name)?.score ?? 0 : 0

  return Math.max(localized, original)
}

async function loadCredits(query: string, person: TmdbPerson): Promise<Scored[]> {
  const response = await getJson<TmdbCombinedCredits>(
    `/person/${person.id}/combined_credits?language=en-US`,
  )

  const results: Scored[] = []

  for (const item of response.cast ?? []) {
    const kind = kindOf(item)
    if (!kind) continue

    const scored = scoreItem(query, item, kind, {
      floor: { score: MATCH_WEIGHTS.actor, kind: 'actor', detail: person.name },
    })
    if (scored) results.push(scored)
  }

  for (const item of response.crew ?? []) {
    if (item.job !== 'Director') continue

    const kind = kindOf(item)
    if (!kind) continue

    const scored = scoreItem(query, item, kind, {
      floor: { score: MATCH_WEIGHTS.director, kind: 'director', detail: person.name },
    })
    if (scored) results.push(scored)
  }

  return results
}

async function loadPeopleResults(query: string): Promise<Scored[]> {
  const language = hasCyrillic(query) ? 'ru-RU' : 'en-US'
  const variants = primaryVariants(query)
  const requests = variants.map((variant) => fetchPeople(variant, language))

  if (language !== 'en-US') {
    requests.push(...variants.map((variant) => fetchPeople(variant, 'en-US')))
  }

  const responses = await Promise.allSettled(requests)
  const people = new Map<number, TmdbPerson>()

  for (const response of responses) {
    if (response.status !== 'fulfilled') continue
    for (const person of response.value) people.set(person.id, person)
  }

  const top = [...people.values()]
    .map((person) => ({ person, score: personMatch(query, person) }))
    .filter((entry) => entry.score >= MATCH_WEIGHTS['title-words'])
    .sort((a, b) => b.score - a.score || (b.person.popularity ?? 0) - (a.person.popularity ?? 0))
    .slice(0, CREDITS_PERSON_LIMIT)

  const credits = await Promise.allSettled(top.map((entry) => loadCredits(query, entry.person)))

  return credits.flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
}

function discoverPaths(entry: GenreEntry, suffix: string): [string, MediaKind][] {
  const paths: [string, MediaKind][] = []

  if (entry.movieId !== null) {
    paths.push([`/discover/movie?with_genres=${entry.movieId}&${suffix}`, 'movie'])
  }

  if (entry.tvId !== null) {
    paths.push([`/discover/tv?with_genres=${entry.tvId}&${suffix}`, 'series'])
  }

  return paths
}

async function loadGenreResults(query: string, genre: GenreEntry): Promise<Scored[]> {
  const suffix = `sort_by=popularity.desc&vote_count.gte=${QUALITY.minVotes}&language=en-US&page=1`
  const paths = discoverPaths(genre, suffix)

  const responses = await Promise.allSettled(
    paths.map(async ([path, kind]) => ({
      kind,
      response: await getJson<TmdbList<TmdbSearchItem>>(path),
    })),
  )

  return responses.flatMap((result) => {
    if (result.status !== 'fulfilled') return []

    const { kind, response } = result.value

    return response.results.flatMap((item) => {
      const scored = scoreItem(query, item, kind, {
        floor: { score: MATCH_WEIGHTS.genre, kind: 'genre', detail: genre.label },
        strict: true,
      })

      return scored ? [scored] : []
    })
  })
}

async function loadKeywordResults(query: string): Promise<Scored[]> {
  // The keyword database is English, so transliterated/translated queries cannot use it.
  if (hasCyrillic(query)) return []

  const keywords = await getJson<TmdbList<TmdbKeyword>>(
    `/search/keyword?query=${encodeURIComponent(query)}&page=1`,
  )

  const folded = fold(query)
  const keyword =
    keywords.results.find((entry) => fold(entry.name) === folded) ??
    keywords.results.find((entry) => matchTitle(query, entry.name) !== null)

  if (!keyword) return []

  const suffix = `with_keywords=${keyword.id}&sort_by=popularity.desc&vote_count.gte=${QUALITY.minVotes}&language=en-US&page=1`
  const paths: [string, MediaKind][] = [
    [`/discover/movie?${suffix}`, 'movie'],
    [`/discover/tv?${suffix}`, 'series'],
  ]

  const responses = await Promise.allSettled(
    paths.map(async ([path, kind]) => ({
      kind,
      response: await getJson<TmdbList<TmdbSearchItem>>(path),
    })),
  )

  return responses.flatMap((result) => {
    if (result.status !== 'fulfilled') return []

    const { kind, response } = result.value

    return response.results.flatMap((item) => {
      const scored = scoreItem(query, item, kind, {
        floor: { score: MATCH_WEIGHTS.keyword, kind: 'keyword', detail: keyword.name },
        strict: true,
      })

      return scored ? [scored] : []
    })
  })
}

type PoolItem = { item: TmdbSearchItem; kind: MediaKind }

const poolCache = new Map<string, { at: number; items: PoolItem[] }>()
const poolInFlight = new Map<string, Promise<PoolItem[]>>()

/**
 * A broad, cached pool of well-known titles. It exists only for typos and partial names that
 * TMDB's exact search cannot resolve ("чел паук", "intersteller").
 */
async function loadPool(language: string): Promise<PoolItem[]> {
  const cached = poolCache.get(language)
  if (cached && Date.now() - cached.at < POOL_CACHE_TTL) return cached.items

  const running = poolInFlight.get(language)
  if (running) return running

  const request = (async () => {
    const base = `sort_by=popularity.desc&vote_count.gte=100&language=${language}`
    const paths: [string, MediaKind][] = [
      [`/discover/movie?${base}&page=1`, 'movie'],
      [`/discover/movie?${base}&page=2`, 'movie'],
      [`/discover/tv?${base}&page=1`, 'series'],
      [`/discover/tv?${base}&page=2`, 'series'],
    ]

    const responses = await Promise.allSettled(
      paths.map(async ([path, kind]) => ({
        kind,
        response: await getJson<TmdbList<TmdbSearchItem>>(path),
      })),
    )

    const items: PoolItem[] = []

    for (const result of responses) {
      if (result.status !== 'fulfilled') continue

      const { kind, response } = result.value
      for (const item of response.results) items.push({ item, kind })
    }

    poolCache.set(language, { at: Date.now(), items })
    return items
  })()

  poolInFlight.set(language, request)

  try {
    return await request
  } finally {
    poolInFlight.delete(language)
  }
}

function poolMatches(query: string, pool: PoolItem[]): Scored[] {
  return pool
    .flatMap(({ item, kind }) => {
      const scored = scoreItem(query, item, kind, { strict: true })
      return scored ? [scored] : []
    })
    .sort(
      (a, b) =>
        b.score - a.score || (b.popularity ?? 0) - (a.popularity ?? 0),
    )
    .slice(0, POOL_MATCH_LIMIT)
}

const searchCache = new Map<string, { at: number; results: SearchResult[] }>()

function cacheKey(query: string): string {
  return fold(query)
}

export function peekSearch(query: string): SearchResult[] | undefined {
  const entry = searchCache.get(cacheKey(query))
  if (!entry) return undefined

  if (Date.now() - entry.at > SEARCH_CACHE_TTL) {
    searchCache.delete(cacheKey(query))
    return undefined
  }

  return entry.results
}

export function invalidateSearch(query: string): void {
  searchCache.delete(cacheKey(query))
}

function cacheResults(query: string, results: SearchResult[]): void {
  if (searchCache.size >= SEARCH_CACHE_LIMIT) {
    const oldest = searchCache.keys().next().value
    if (oldest !== undefined) searchCache.delete(oldest)
  }

  searchCache.set(cacheKey(query), { at: Date.now(), results })
}

/**
 * Progressive search. `onUpdate` is called after every stage, so the first batch of results is
 * visible while people credits, genres and keywords are still being ranked.
 */
export async function searchMedia(
  query: string,
  onUpdate?: (results: SearchResult[]) => void,
): Promise<SearchResult[]> {
  const raw = query.trim()
  if (raw.length === 0) return []

  const collected = new Map<string, Scored>()
  const emit = (): SearchResult[] => {
    const results = finalize(collected)
    onUpdate?.(results)
    return results
  }

  const variants = primaryVariants(raw)
  const genre = detectGenre(raw)

  // 1. Titles. This is the fastest stage and produces the first visible batch.
  const multiResponses = await Promise.allSettled(variants.map((variant) => fetchMulti(variant)))

  for (const response of multiResponses) {
    if (response.status !== 'fulfilled') continue

    response.value.forEach((item, rank) => {
      const kind = kindOf(item)
      if (!kind) return

      // A genre request is about the genre, not about a title that happens to contain its translated
      // name ("боевик" → "Action Jackson"), so the API's own ranking is not used as a fallback here.
      const scored = scoreItem(raw, item, kind, genre ? {} : { serverRank: rank })
      if (scored) addScored(collected, scored)
    })
  }

  emit()

  // 2. Everything else runs in parallel: actor/director credits, genre and keyword searches.
  const merge = (promise: Promise<Scored[]>) =>
    promise
      .then((items) => {
        for (const item of items) addScored(collected, item)
        emit()
      })
      .catch(() => {})

  await Promise.all([
    merge(genre ? Promise.resolve([]) : loadPeopleResults(raw)),
    merge(genre ? loadGenreResults(raw, genre) : Promise.resolve([])),
    merge(genre ? Promise.resolve([]) : loadKeywordResults(raw)),
  ])

  // 3. Correction is conditional: only when relevance itself is weak do we try the wrong-layout
  //    variant and the fuzzy pool. A good result is never replaced by a "corrected" one.
  const current = emit()
  const strongMatches = current.filter(
    (result) => result.score >= MATCH_WEIGHTS['title-words'],
  ).length

  if (!genre && strongMatches < 3 && raw.length >= 3) {
    const extraVariants = fallbackVariants(raw)

    for (const variant of extraVariants) {
      try {
        const items = await fetchMulti(variant)
        items.forEach((item, rank) => {
          const kind = kindOf(item)
          if (!kind) return

          const scored = scoreItem(raw, item, kind, { serverRank: rank })
          if (scored) addScored(collected, scored)
        })
      } catch {
        // A speculative correction must never fail the search.
      }
    }

    if (extraVariants.length > 0) emit()

    try {
      const pool = await loadPool(hasCyrillic(raw) ? 'ru-RU' : 'en-US')
      for (const item of poolMatches(raw, pool)) addScored(collected, item)
      emit()
    } catch {
      // The pool is an optional safety net for typos.
    }
  }

  const results = emit()
  cacheResults(raw, results)
  return results
}
