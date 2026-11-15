import { useRef, type CSSProperties, type RefObject } from 'react'
import type { PopularMediaItem } from '@/api/tmdb'
import MediaCard from '@/components/MediaCard/MediaCard'
import { MediaCardSkeleton } from '@/components/Skeleton/Skeleton'
import { useGridColumns } from '@/hooks/useGridColumns'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import './CardGrid.css'

/** Desktop cards start a new column below the home rails' minimum width. */
const MIN_CARD_WIDTH = 150
const MOBILE_MIN_CARD_WIDTH = 100
const COLUMN_GAP = 16
const MOBILE_COLUMN_GAP = 12

type CardGridProps = {
  label: string
  items: PopularMediaItem[]
  /** Show at most this many rows; extra items are not rendered. */
  maxRows?: number
  /** Eager-load the first row of posters. */
  priority?: boolean
}

function gridStyle(columns: number): CSSProperties {
  return { '--card-grid-columns': Math.max(columns, 2) } as CSSProperties
}

/**
 * On phones the cards get narrower: three fit in a row on a regular phone, four on a very wide
 * one, and never fewer than three. Desktop keeps the roomier rail-sized cards.
 */
function useGridLayout(ref: RefObject<HTMLUListElement | null>) {
  const isMobile = useMediaQuery('(max-width: 768px)')

  const columns = useGridColumns(
    ref,
    isMobile ? MOBILE_MIN_CARD_WIDTH : MIN_CARD_WIDTH,
    isMobile ? MOBILE_COLUMN_GAP : COLUMN_GAP,
    isMobile ? 3 : 2,
    isMobile ? 4 : Number.POSITIVE_INFINITY,
  )

  return { columns, isMobile }
}

function CardGrid({ items, label, maxRows, priority = false }: CardGridProps) {
  const ref = useRef<HTMLUListElement>(null)
  const { columns } = useGridLayout(ref)
  const visible = columns === 0 ? [] : maxRows ? items.slice(0, columns * maxRows) : items

  return (
    <ul ref={ref} className="card-grid" style={gridStyle(columns)} aria-label={label}>
      {visible.map((item, index) => (
        <li className="card-grid__item" key={`${item.kind}-${item.id}`}>
          <MediaCard item={item} priority={priority && index < columns} />
        </li>
      ))}
    </ul>
  )
}

type CardGridSkeletonProps = {
  /** Rows of placeholder cards. */
  rows?: number
}

/** Uses the same column calculation as `CardGrid`, so the real cards land without a reflow. */
export function CardGridSkeleton({ rows = 2 }: CardGridSkeletonProps) {
  const ref = useRef<HTMLUListElement>(null)
  const { columns } = useGridLayout(ref)

  return (
    <ul
      ref={ref}
      className="card-grid card-grid--skeleton"
      style={gridStyle(columns)}
      aria-hidden="true"
    >
      {Array.from({ length: columns * rows }, (_, index) => (
        <li className="card-grid__item" key={index}>
          <MediaCardSkeleton />
        </li>
      ))}
    </ul>
  )
}

export default CardGrid
