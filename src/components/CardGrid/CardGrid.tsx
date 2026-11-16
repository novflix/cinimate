import { useRef } from 'react'
import type { PopularMediaItem } from '@/api/tmdb'
import MediaCard from '@/components/MediaCard/MediaCard'
import { MediaCardSkeleton } from '@/components/Skeleton/Skeleton'
import { gridStyle, useGridLayout } from '@/hooks/useCardGridLayout'
import './CardGrid.css'

type CardGridProps = {
  label: string
  items: PopularMediaItem[]
  /** Show at most this many rows; extra items are not rendered. */
  maxRows?: number
  /** Eager-load the first row of posters. */
  priority?: boolean
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
