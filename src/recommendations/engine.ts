import type { PopularMediaItem } from '@/api/tmdb'
import type { Library } from '@/lib/library'
import {
  buildColdPlan,
  buildPlan,
  fetchQueryPage,
  type Query,
} from './candidates'
import { REC } from './config'
import { loadFeatures } from './features'
import { impressionsOf } from './impressions'
import { buildProfile, type TasteProfile } from './profile'
import { collectSignals, librarySignature } from './signals'
import { contentScore, scoreCandidate, similarity, type Candidate } from './scoring'

export type FeedEngine = {
  /** The next `count` titles, best first. Resolves with fewer (or none) when TMDB has nothing left. */
  next: (count: number, library: Library) => Promise<PopularMediaItem[]>
  /** False once every source is used up and nothing is left in the pool. */
  hasMore: () => boolean
  /** True while the user has too little history for a personal feed. */
  isCold: () => boolean
}

type Scored = { candidate: Candidate; score: number }

const SHORTLIST_SIZE = 150
const RECENT_CONTEXT = 6
const MAX_QUERY_FAILURES = 2

function isExcluded(key: string, library: Library): boolean {
  return (
    key in library.watched ||
    key in library.watchlist ||
    key in library.dismissed ||
    key in library.ratings
  )
}

/**
 * The recommendation feed for one user, from the saved library to a ranked, endless list:
 *
 *   1. `sync`   – learn the taste profile (cached titles + a few TMDB requests) and plan queries
 *   2. `refill` – walk the queries page by page, collecting candidates into a pool
 *   3. `select` – score the pool, then pick page by page with diversity (MMR) and exploration
 *
 * Titles already watched, saved, rated or hidden are never picked, and the profile is rebuilt
 * whenever the library changes, so a "Not interested" shapes the very next page.
 */
export function createFeedEngine(uid: string): FeedEngine {
  let signature = ''
  let profile: TasteProfile | null = null
  let cold = true
  let plan: Query[] = []

  const nextPage = new Map<string, number>()
  const finished = new Set<string>()
  const failures = new Map<string, number>()
  const lastFetched = new Map<string, number>()
  let refillCount = 0

  const known = new Map<string, Candidate>()
  const pool = new Map<string, Candidate>()
  const emitted = new Set<string>()
  const recent: Candidate[] = []

  let dry = 0
  let exhausted = false

  async function sync(library: Library) {
    const next = librarySignature(library)
    if (next === signature && profile) return

    const signals = collectSignals(library)
    const liked = signals
      .filter((signal) => signal.weight > 0)
      .sort((a, b) => b.weight - a.weight)
    const disliked = signals
      .filter((signal) => signal.weight < 0)
      .sort((a, b) => a.weight - b.weight)

    const learnFrom = [
      ...liked.slice(0, REC.positiveSeedLimit),
      ...disliked.slice(0, REC.negativeSeedLimit),
    ]
    const features = await loadFeatures(learnFrom.map((signal) => signal.ref))

    profile = buildProfile(learnFrom, features)
    cold = liked.length < REC.minSignals

    const nextPlan = cold ? buildColdPlan() : buildPlan(profile)
    const sameQueries =
      nextPlan.length === plan.length && nextPlan.every((query, i) => query.id === plan[i].id)

    plan = nextPlan
    signature = next

    // New queries mean new places to look: the feed may have more to give again.
    if (!sameQueries) {
      exhausted = false
      dry = 0
      lastFetched.clear()
    }
  }

  function merge(candidate: Candidate): number {
    if (emitted.has(candidate.key)) return 0

    const existing = known.get(candidate.key)
    if (existing) {
      existing.seedSupport += candidate.seedSupport
      existing.evidence = Math.min(1, existing.evidence + candidate.evidence)
      candidate.roles.forEach((role) => existing.roles.add(role))
      return 0
    }

    known.set(candidate.key, candidate)
    pool.set(candidate.key, candidate)
    return 1
  }

  async function refill() {
    // Within a round the strongest sources go first; between rounds every source gets a turn,
    // so one long query cannot starve the rest of the plan.
    const active = plan
      .filter((query) => !finished.has(query.id))
      .sort((a, b) => {
        const turn = (lastFetched.get(a.id) ?? -1) - (lastFetched.get(b.id) ?? -1)
        return turn !== 0 ? turn : b.priority - a.priority
      })

    if (active.length === 0) {
      exhausted = true
      return
    }

    const batch = active.slice(0, REC.queriesPerRefill)
    refillCount += 1

    const settled = await Promise.allSettled(
      batch.map(async (query) => {
        const page = nextPage.get(query.id) ?? 1
        return { query, page, result: await fetchQueryPage(query, page) }
      }),
    )

    let added = 0
    let failed = 0
    let firstError: unknown = null

    settled.forEach((outcome, index) => {
      const id = batch[index].id
      lastFetched.set(id, refillCount)

      if (outcome.status === 'rejected') {
        failed += 1
        firstError ??= outcome.reason
        const count = (failures.get(id) ?? 0) + 1
        failures.set(id, count)
        if (count >= MAX_QUERY_FAILURES) finished.add(id)
        return
      }

      const { query, page, result } = outcome.value
      nextPage.set(query.id, page + 1)
      if (!result.hasMorePages) finished.add(query.id)
      result.candidates.forEach((candidate) => {
        added += merge(candidate)
      })
    })

    // Every request failed and there is nothing else to try: surface it so the UI can offer a
    // retry. If lower-priority queries remain, the next attempt gives them a turn instead.
    if (failed === batch.length && batch.length === active.length) throw firstError

    const untried = plan.some(
      (query) => !finished.has(query.id) && !lastFetched.has(query.id),
    )

    dry = added === 0 ? dry + 1 : 0
    if (plan.every((query) => finished.has(query.id)) || (dry >= 2 && !untried)) {
      exhausted = true
    }
  }

  function liveCount(library: Library): number {
    for (const key of [...pool.keys()]) {
      if (isExcluded(key, library)) pool.delete(key)
    }
    return pool.size
  }

  function pickExplore(shortlist: Scored[]): number {
    if (!profile) return -1
    let best = -1

    shortlist.forEach(({ candidate, score }, index) => {
      const outside = [...candidate.roles].every((role) => role === 'explore')
      if (!outside || contentScore(candidate, profile!) < -0.15) return
      if (best < 0 || score > shortlist[best].score) best = index
    })

    return best
  }

  function pickDiverse(shortlist: Scored[], context: Candidate[]): number {
    const top = shortlist[0].score || 1
    let best = 0
    let bestValue = -Infinity

    shortlist.forEach(({ candidate, score }, index) => {
      const closest = context.reduce(
        (max, other) => Math.max(max, similarity(candidate, other)),
        0,
      )
      const value = REC.mmrLambda * (score / top) - (1 - REC.mmrLambda) * closest

      if (value > bestValue) {
        bestValue = value
        best = index
      }
    })

    return best
  }

  function select(count: number): PopularMediaItem[] {
    if (!profile) return []

    const impressions = impressionsOf(uid)
    const shortlist: Scored[] = [...pool.values()]
      .map((candidate) => ({
        candidate,
        score: scoreCandidate(candidate, profile!, impressions.get(candidate.key) ?? 0),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, SHORTLIST_SIZE)

    const chosen: Candidate[] = []

    while (chosen.length < count && shortlist.length > 0) {
      const slot = emitted.size
      let index = -1

      if (slot % REC.exploreEvery === REC.exploreEvery - 1) index = pickExplore(shortlist)
      if (index < 0) index = pickDiverse(shortlist, [...recent.slice(-RECENT_CONTEXT), ...chosen])

      const [{ candidate }] = shortlist.splice(index, 1)
      chosen.push(candidate)
      pool.delete(candidate.key)
      emitted.add(candidate.key)
    }

    recent.push(...chosen)
    return chosen.map((candidate) => candidate.item)
  }

  return {
    async next(count, library) {
      await sync(library)

      const wanted = count * REC.poolPerRequested
      for (let attempt = 0; attempt < 3; attempt += 1) {
        if (exhausted || liveCount(library) >= wanted) break
        await refill()
      }

      liveCount(library)
      return select(count)
    },

    hasMore: () => !exhausted || pool.size > 0,
    isCold: () => cold,
  }
}
