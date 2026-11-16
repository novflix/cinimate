import type { CSSProperties, RefObject } from 'react'
import { useGridColumns } from '@/hooks/useGridColumns'
import { useMediaQuery } from '@/hooks/useMediaQuery'

/** Desktop cards start a new column below the home rails' minimum width. */
const MIN_CARD_WIDTH = 150
const MOBILE_MIN_CARD_WIDTH = 100
const COLUMN_GAP = 16
const MOBILE_COLUMN_GAP = 12

export function gridStyle(columns: number): CSSProperties {
  return { '--card-grid-columns': Math.max(columns, 2) } as CSSProperties
}

/**
 * On phones the cards get narrower: three fit in a row on a regular phone, four on a very wide
 * one, and never fewer than three. Desktop keeps the roomier rail-sized cards.
 */
export function useGridLayout(
  ref: RefObject<HTMLUListElement | null>,
  /** Pins the phone layout to this many columns (the default is three, four on wide phones). */
  mobileColumns?: number,
) {
  const isMobile = useMediaQuery('(max-width: 768px)')

  const columns = useGridColumns(
    ref,
    isMobile ? MOBILE_MIN_CARD_WIDTH : MIN_CARD_WIDTH,
    isMobile ? MOBILE_COLUMN_GAP : COLUMN_GAP,
    isMobile ? (mobileColumns ?? 3) : 2,
    isMobile ? (mobileColumns ?? 4) : Number.POSITIVE_INFINITY,
  )

  return { columns, isMobile }
}
