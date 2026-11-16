import type { MediaKind, PopularMediaItem } from '@/api/tmdb'
import { REC } from './config'
import type { TasteProfile } from './profile'

/** A title that could go into the feed, with everything the scoring needs. */
export type Candidate = {
  key: string
  kind: MediaKind
  item: PopularMediaItem
  genreIds: number[]
  language: string
  year: number
  votes: number
  rating: number
  popularity: number
  /** How strongly the user's favourites point at this title (TMDB "also liked"), sum of seed weights. */
  seedSupport: number
  /** 0–1: found by a keyword / person query built from the user's own taste. */
  evidence: number
  /** Where it came from; only `explore` means "outside the known taste". */
  roles: Set<'seed' | 'discover' | 'explore' | 'base'>
}

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))

/**
 * How well the title fits the taste, from -1 to +1. Only cheap features are used here (the
 * lists TMDB returns for free); keywords and people matter through `evidence`.
 */
export function contentScore(candidate: Candidate, profile: TasteProfile): number {
  const genreValues = candidate.genreIds.map((id) => profile.genres.get(id) ?? 0)
  const genre = genreValues.length ? genreValues.reduce((a, b) => a + b, 0) / genreValues.length : 0

  const language = profile.languages.get(candidate.language) ?? 0
  const decade = profile.decades.get(Math.floor(candidate.year / 10) * 10) ?? 0
  const kind = profile.kinds[candidate.kind]

  return clamp(
    0.55 * genre + 0.1 * language + 0.1 * decade + 0.1 * kind + 0.35 * candidate.evidence,
    -1,
    1,
  )
}

/** Bayesian average: a 9.0 from 12 votes is worth less than an 8.2 from 20 000. */
export function qualityScore(candidate: Candidate): number {
  const m = REC.bayesVotes
  const v = candidate.votes
  const bayes = (v / (v + m)) * candidate.rating + (m / (v + m)) * REC.bayesMean

  return clamp((bayes - 5.5) / 3)
}

function popularityScore(candidate: Candidate): number {
  return clamp(Math.log10(1 + candidate.popularity) / Math.log10(1 + 500))
}

function freshnessScore(candidate: Candidate): number {
  if (!candidate.year) return 0.3

  const age = Math.max(0, new Date().getFullYear() - candidate.year)
  return Math.exp(-age / 20)
}

export function scoreCandidate(
  candidate: Candidate,
  profile: TasteProfile,
  impressions: number,
): number {
  const w = REC.score
  const confidence = profile.confidence

  // The less is known about the user, the more the generic quality signals have to carry.
  const contentWeight = w.content * confidence
  const qualityWeight = w.quality + w.content * (1 - confidence)

  const seed = 1 - Math.exp(-candidate.seedSupport * 1.5)
  const content = (contentScore(candidate, profile) + 1) / 2

  const base =
    contentWeight * content +
    w.seed * seed +
    qualityWeight * qualityScore(candidate) +
    w.popularity * popularityScore(candidate) +
    w.freshness * freshnessScore(candidate)

  return base * (1 - REC.impressionPenalty * Math.min(impressions, REC.maxImpressions))
}

/** How alike two titles are, 0–1: used to keep a page of the feed varied. */
export function similarity(a: Candidate, b: Candidate): number {
  const shared = a.genreIds.filter((id) => b.genreIds.includes(id)).length
  const union = new Set([...a.genreIds, ...b.genreIds]).size
  const genres = union ? shared / union : 0

  const sameKind = a.kind === b.kind ? 1 : 0
  const sameDecade = Math.floor(a.year / 10) === Math.floor(b.year / 10) ? 1 : 0

  return 0.7 * genres + 0.15 * sameKind + 0.15 * sameDecade
}
