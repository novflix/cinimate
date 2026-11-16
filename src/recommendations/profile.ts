import type { MediaKind } from '@/api/tmdb'
import type { TitleRef } from '@/lib/library'
import { REC } from './config'
import type { TitleFeatures } from './features'
import type { Signal } from './signals'

/** Feature id → how much the user likes it, from -1 to +1. */
export type Affinity = Map<number, number>

export type Seed = { ref: TitleRef; weight: number }

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

  let total = 0

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
  }

  const kindAffinity = finish(kinds, total)

  const seeds = signals
    .filter((signal) => signal.weight > 0.25)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, REC.recommendationSeeds)
    .map(({ ref, weight }) => ({ ref, weight }))

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
    seeds,
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
