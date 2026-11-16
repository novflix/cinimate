import { nowInSeconds, parseTitleKey, type Library, type TitleRef } from '@/lib/library'
import { REC } from './config'

export type Signal = {
  key: string
  ref: TitleRef
  /** From -1 (strong dislike) to +1 (strong like), already faded by age. */
  weight: number
}

/** A 10 is +1, a 1 is -1; 6 is barely positive and 5 barely negative. */
export function ratingWeight(rating: number): number {
  return (rating - 5.5) / 4.5
}

function decay(savedAt: number, now: number): number {
  const ageDays = Math.max(0, now - savedAt) / 86_400
  return Math.max(REC.minDecay, 0.5 ** (ageDays / REC.halfLifeDays))
}

/**
 * Turns the saved library into one weighted signal per title. When several apply, the most
 * informative wins: a rating beats "watched", which beats the watchlist, which beats "hidden".
 */
export function collectSignals(library: Library, now = nowInSeconds()): Signal[] {
  const keys = new Set([
    ...Object.keys(library.ratings),
    ...Object.keys(library.watched),
    ...Object.keys(library.watchlist),
    ...Object.keys(library.dismissed),
  ])

  const signals: Signal[] = []

  for (const key of keys) {
    const ref = parseTitleKey(key)
    if (!ref) continue

    const rating = library.ratings[key]
    let weight: number
    let at: number

    if (rating !== undefined) {
      weight = ratingWeight(rating)
      at = library.watched[key] ?? now
    } else if (key in library.watched) {
      weight = REC.weights.watchedUnrated
      at = library.watched[key]
    } else if (key in library.watchlist) {
      weight = REC.weights.watchlist
      at = library.watchlist[key]
    } else {
      weight = REC.weights.dismissed
      at = library.dismissed[key]
    }

    signals.push({ key, ref, weight: weight * decay(at, now) })
  }

  return signals
}

/** Changes whenever something that can alter the taste changes (cheap to compare). */
export function librarySignature(library: Library): string {
  const newest = (saved: Record<string, number>) =>
    Object.keys(saved).length + ':' + Math.max(0, ...Object.values(saved))

  return [
    newest(library.watchlist),
    newest(library.watched),
    newest(library.dismissed),
    Object.keys(library.ratings).length,
    Object.values(library.ratings).reduce((sum, rating) => sum + rating, 0),
  ].join('|')
}

/** How many different titles tell the feed something about the taste (hidden ones do not count). */
export function countTasteTitles(library: Library): number {
  return new Set([
    ...Object.keys(library.ratings),
    ...Object.keys(library.watched),
    ...Object.keys(library.watchlist),
  ]).size
}
