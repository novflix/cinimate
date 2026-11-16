import type { MediaKind } from '@/api/tmdb'
import type { TitleRef } from '@/lib/library'
import { REC } from './config'
import type { TitleFeatures } from './features'
import type { Signal } from './signals'

/** Feature id → how much the user likes it, from -1 to +1. */
export type Affinity = Map<number, number>

export type Seed = { ref: TitleRef; weight: number }

/** The release years the user actually watches, learned from the titles they liked. */
export type EraProfile = {
  /** Weighted mean release year; 0 when there is nothing to learn from. */
  center: number
  /** Typical distance from `center`, in years. */
  spread: number
  /** 0–1: how much the estimate can be trusted. */
  confidence: number
}

/** What the titles the user hid or rated low have in common. */
export type NegativeTaste = {
  genres: Affinity
  languages: Map<string, number>
  decades: Map<number, number>
  kinds: Record<MediaKind, number>
  /** 0–1: how many negative signals back the suppression. */
  strength: number
}

export type TasteProfile = {
  genres: Affinity
  keywords: Affinity
  people: Affinity
  /** Actors only, kept separately from directors so recurring faces can drive their own queries. */
  cast: Affinity
  /** How many of the user's titles carry each keyword / person / actor (one-offs are weak evidence). */
  keywordCounts: Map<number, number>
  peopleCounts: Map<number, number>
  castCounts: Map<number, number>
  languages: Map<string, number>
  decades: Map<number, number>
  kinds: Record<MediaKind, number>
  /** The era the user actually watches, used to keep freshness personal instead of forcing age. */
  era: EraProfile
  /** The disliked corner of the taste, used to push similar candidates down. */
  negative: NegativeTaste
  /** The best-liked titles, strongest first: they ask TMDB for similar ones. */
  seeds: Seed[]
  /** Number of weighted signals the profile is built from. */
  signalCount: number
  /** 0 (nothing known) to 1 (enough signals for the taste to be trusted). */
  confidence: number
}

type Accumulator<K> = { sum: Map<K, number>; count: Map<K, number> }

const accumulator = <K>(): Accumulator<K> => ({ sum: new Map(), count: new Map() })

function add<K>(target: Accumulator<K>, key: K, weight: number) {
  target.sum.set(key, (target.sum.get(key) ?? 0) + weight)
  target.count.set(key, (target.count.get(key) ?? 0) + 1)
}

/**
 * affinity = Σ weight / (count + shrinkage), damped for features that appear in most titles.
 * The shrinkage keeps a single title from defining a taste; the damping keeps "Drama" from
 * drowning everything else for someone who mostly watches dramas.
 */
function finish<K>({ sum, count }: Accumulator<K>, total: number): Map<K, number> {
  const result = new Map<K, number>()

  for (const [key, value] of sum) {
    const n = count.get(key) ?? 1
    const share = total > 0 ? n / total : 0
    const affinity = (value / (n + REC.shrinkage)) / (1 + REC.commonDamping * share)
    result.set(key, Math.max(-1, Math.min(1, affinity)))
  }

  return result
}

function overlap(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 0

  const left = new Set(a)
  const shared = b.filter((id) => left.has(id)).length
  return shared / new Set([...a, ...b]).size
}

function seedSimilarity(a: TitleFeatures, b: TitleFeatures): number {
  const year = a.year && b.year ? Math.exp(-Math.abs(a.year - b.year) / 12) : 0

  return (
    0.42 * overlap(a.genres, b.genres) +
    0.22 * overlap(a.keywords, b.keywords) +
    0.12 * overlap(a.people, b.people) +
    0.1 * overlap(a.cast, b.cast) +
    0.08 * (a.kind === b.kind ? 1 : 0) +
    0.06 * year
  )
}

/**
 * Seeds are chosen for spread, not just weight: eight near-identical favourites would ask TMDB
 * for eight near-identical lists. Weaker titles are still used when no diverse ones are left.
 */
function pickSeeds(signals: Signal[], features: Map<string, TitleFeatures>): Seed[] {
  const ranked = signals
    .filter((signal) => signal.weight > 0.25)
    .sort((a, b) => b.weight - a.weight)

  const seeds: Seed[] = []
  const chosenKeys = new Set<string>()
  const chosenFeatures: TitleFeatures[] = []

  const take = (signal: Signal) => {
    seeds.push({ ref: signal.ref, weight: signal.weight })
    chosenKeys.add(signal.key)

    const f = features.get(signal.key)
    if (f) chosenFeatures.push(f)
  }

  for (const signal of ranked) {
    if (seeds.length >= REC.recommendationSeeds) break

    const f = features.get(signal.key)
    if (!f || chosenFeatures.every((other) => seedSimilarity(f, other) < REC.seedDiversity)) {
      take(signal)
    }
  }

  // The diverse picks came from the strongest titles, but the feed still wants a full set.
  for (const signal of ranked) {
    if (seeds.length >= REC.recommendationSeeds) break
    if (!chosenKeys.has(signal.key)) take(signal)
  }

  return seeds
}

export function buildProfile(
  signals: Signal[],
  features: Map<string, TitleFeatures>,
): TasteProfile {
  const genres = accumulator<number>()
  const keywords = accumulator<number>()
  const people = accumulator<number>()
  const cast = accumulator<number>()
  const languages = accumulator<string>()
  const decades = accumulator<number>()
  const kinds = accumulator<MediaKind>()

  const negativeGenres = accumulator<number>()
  const negativeLanguages = accumulator<string>()
  const negativeDecades = accumulator<number>()
  const negativeKinds = accumulator<MediaKind>()

  let total = 0
  let positiveYearWeight = 0
  let positiveYearSum = 0
  let positiveYearSquares = 0
  let positiveYearCount = 0
  let negativeTotal = 0

  for (const { key, weight } of signals) {
    const f = features.get(key)
    if (!f) continue

    total += 1
    f.genres.forEach((id) => add(genres, id, weight))
    f.keywords.forEach((id) => add(keywords, id, weight))
    f.people.forEach((id) => add(people, id, weight))
    f.cast.forEach((id) => add(cast, id, weight))
    if (f.language) add(languages, f.language, weight)
    if (f.year) add(decades, Math.floor(f.year / 10) * 10, weight)
    add(kinds, f.kind, weight)

    if (weight > 0) {
      if (f.year) {
        positiveYearWeight += weight
        positiveYearSum += f.year * weight
        positiveYearSquares += f.year * f.year * weight
        positiveYearCount += 1
      }
    } else if (weight < 0) {
      negativeTotal += 1
      const magnitude = -weight

      f.genres.forEach((id) => add(negativeGenres, id, magnitude))
      if (f.language) add(negativeLanguages, f.language, magnitude)
      if (f.year) add(negativeDecades, Math.floor(f.year / 10) * 10, magnitude)
      add(negativeKinds, f.kind, magnitude)
    }
  }

  const kindAffinity = finish(kinds, total)
  const negativeKindAffinity = finish(negativeKinds, negativeTotal)
  const eraCenter = positiveYearWeight > 0 ? positiveYearSum / positiveYearWeight : 0
  const eraVariance =
    positiveYearWeight > 0
      ? Math.max(0, positiveYearSquares / positiveYearWeight - eraCenter * eraCenter)
      : 0

  return {
    genres: finish(genres, total),
    keywords: finish(keywords, total),
    people: finish(people, total),
    cast: finish(cast, total),
    keywordCounts: keywords.count,
    peopleCounts: people.count,
    castCounts: cast.count,
    languages: finish(languages, total),
    decades: finish(decades, total),
    kinds: { movie: kindAffinity.get('movie') ?? 0, series: kindAffinity.get('series') ?? 0 },
    era: {
      center: eraCenter,
      spread: Math.sqrt(eraVariance),
      confidence: Math.min(1, positiveYearCount / REC.fullConfidenceSignals),
    },
    negative: {
      genres: finish(negativeGenres, negativeTotal),
      languages: finish(negativeLanguages, negativeTotal),
      decades: finish(negativeDecades, negativeTotal),
      kinds: {
        movie: negativeKindAffinity.get('movie') ?? 0,
        series: negativeKindAffinity.get('series') ?? 0,
      },
      strength: Math.min(1, negativeTotal / REC.negativeConfidence),
    },
    seeds: pickSeeds(signals, features),
    signalCount: signals.length,
    confidence: Math.min(1, signals.length / REC.fullConfidenceSignals),
  }
}

/** The ids with the highest positive affinity. `minCount` skips one-off features when possible. */
export function topFeatures(
  affinity: Affinity,
  counts: Map<number, number> | null,
  limit: number,
  minCount = 1,
): number[] {
  const ranked = [...affinity.entries()]
    .filter(([, value]) => value > 0.05)
    .sort(([, a], [, b]) => b - a)

  const solid = counts ? ranked.filter(([id]) => (counts.get(id) ?? 0) >= minCount) : ranked
  return (solid.length >= limit ? solid : ranked).slice(0, limit).map(([id]) => id)
}

/**
 * The actors who keep appearing in the titles the user saved and rated highly. The count
 * matters: an actor in four liked titles is a stronger signal than one in two, even when their
 * average affinity is the same.
 */
export function favouriteActors(profile: TasteProfile): number[] {
  const ranked: { id: number; score: number }[] = []

  for (const [id, affinity] of profile.cast) {
    const count = profile.castCounts.get(id) ?? 0
    if (affinity <= 0.05 || count < REC.cast.minTitles) continue
    ranked.push({ id, score: affinity * Math.log2(1 + count) })
  }

  return ranked
    .sort((a, b) => b.score - a.score)
    .slice(0, REC.cast.queryLimit)
    .map(({ id }) => id)
}
