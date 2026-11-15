export const MIN_RATING = 1
export const MAX_RATING = 10

/** Colour of the rating UI while nothing is chosen yet. */
export const NEUTRAL_RATING_COLOR = '#8a8b84'

type RatingStep = { label: string; color: string }

/**
 * Index 0 is a 1/10. The colour runs from red through amber to the brand lime and on to mint,
 * so the accent of the rating UI tells the score at a glance. 7 is exactly `--accent`.
 */
const SCALE: readonly RatingStep[] = [
  { label: 'Terrible', color: '#ff4d4d' },
  { label: 'Awful', color: '#ff6b3d' },
  { label: 'Bad', color: '#ff8a3d' },
  { label: 'Poor', color: '#ffa93d' },
  { label: 'Mediocre', color: '#ffd83d' },
  { label: 'Decent', color: '#e1f230' },
  { label: 'Good', color: '#c2fe1f' },
  { label: 'Great', color: '#8ff53a' },
  { label: 'Excellent', color: '#4be883' },
  { label: 'Masterpiece', color: '#2de8c8' },
]

/** A rating is a whole number from 1 to 10. */
export function isValidRating(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_RATING &&
    value <= MAX_RATING
  )
}

export function clampRating(value: number): number {
  return Math.min(MAX_RATING, Math.max(MIN_RATING, Math.round(value)))
}

export function ratingLabel(rating: number): string {
  return SCALE[clampRating(rating) - 1].label
}

export function ratingColor(rating: number): string {
  return SCALE[clampRating(rating) - 1].color
}
