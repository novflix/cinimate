import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import CarouselArrow from '@/components/CarouselArrow/CarouselArrow'
import MediaCard from '@/components/MediaCard/MediaCard'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import type { PopularMediaItem } from '@/api/tmdb'
import './MediaRail.css'

type MediaRailProps<T> = {
  title: string
  items: T[]
  /** Renders one item. Without it every item is a `MediaCard`, so `items` must be media items. */
  renderItem?: (item: T) => ReactNode
  itemKey?: (item: T) => string | number
  /** Extra class for the item wrapper, e.g. to give people cards their own width. */
  itemClassName?: string
  /** The first cards in the rail are likely above the fold, so load them eagerly. */
  priority?: boolean
}

function MediaRail<T = PopularMediaItem>({
  title,
  items,
  renderItem,
  itemKey,
  itemClassName,
  priority = false,
}: MediaRailProps<T>) {
  const headingId = useId()
  const isMobile = useMediaQuery('(max-width: 768px)')
  const trackRef = useRef<HTMLUListElement>(null)
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)

  const updateScrollState = useCallback(() => {
    const track = trackRef.current
    if (!track) return

    setCanScrollPrev(track.scrollLeft > 1)
    setCanScrollNext(track.scrollLeft + track.clientWidth < track.scrollWidth - 1)
  }, [])

  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    updateScrollState()

    const observer = new ResizeObserver(updateScrollState)
    observer.observe(track)

    return () => observer.disconnect()
  }, [items, updateScrollState])

  const scrollByPage = (direction: 1 | -1) => {
    const track = trackRef.current
    if (!track) return

    track.scrollBy({ left: track.clientWidth * 0.8 * direction, behavior: 'smooth' })
  }

  return (
    <section className="media-rail" aria-labelledby={headingId}>
      <div className="media-rail__header">
        <h2 className="media-rail__title" id={headingId}>
          {title}
        </h2>

        {!isMobile && (
          <div className="media-rail__controls">
            <CarouselArrow
              direction="back"
              label={`Scroll ${title} back`}
              disabled={!canScrollPrev}
              onClick={() => scrollByPage(-1)}
            />
            <CarouselArrow
              direction="forward"
              label={`Scroll ${title} forward`}
              disabled={!canScrollNext}
              onClick={() => scrollByPage(1)}
            />
          </div>
        )}
      </div>

      <ul className="media-rail__track" ref={trackRef} onScroll={updateScrollState}>
        {items.map((item, index) => {
          const media = item as PopularMediaItem

          return (
            <li
              className={`media-rail__item${itemClassName ? ` ${itemClassName}` : ''}`}
              key={itemKey ? itemKey(item) : `${media.kind}-${media.id}`}
            >
              {renderItem ? (
                renderItem(item)
              ) : (
                <MediaCard item={media} priority={priority && index < 5} />
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default MediaRail