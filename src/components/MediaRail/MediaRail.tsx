import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { AltArrowLeftIcon } from '@solar-icons/react/bold/alt-arrow-left'
import { AltArrowRightIcon } from '@solar-icons/react/bold/alt-arrow-right'
import MediaCard from '@/components/MediaCard/MediaCard'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import type { LiquidGlassController, LiquidGlassOptions } from '@/vendor/liquid-glass'
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
}

// Rail arrows float over the page, so backdrop mode refracts the live content behind them
// in Chromium and falls back to frosted blur elsewhere — the same pattern as MobileNav.
const arrowGlass: LiquidGlassOptions = {
  mode: 'backdrop',
  fit: true,
  radius: 20,
  refraction: 10,
  bezel: 0.6,
  curvature: 3,
  ior: 1.45,
  chroma: 0.04,
  blur: 8,
  specular: 0.45,
  specularWidth: 1.5,
  lightAngle: -90,
  fallback: 'blur(16px) saturate(150%)',
}

function MediaRail<T = PopularMediaItem>({
  title,
  items,
  renderItem,
  itemKey,
  itemClassName,
}: MediaRailProps<T>) {
  const headingId = useId()
  const isMobile = useMediaQuery('(max-width: 768px)')
  const trackRef = useRef<HTMLUListElement>(null)
  const prevRef = useRef<HTMLButtonElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
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

  useEffect(() => {
    if (isMobile) return

    let disposed = false
    let controllers: LiquidGlassController[] = []

    void import('@/vendor/components.js').then(({ createGlass }) => {
      if (disposed) return

      controllers = [prevRef.current, nextRef.current]
        .filter((element): element is HTMLButtonElement => element !== null)
        .map((element) => createGlass(element, arrowGlass))
    })

    return () => {
      disposed = true
      controllers.forEach((controller) => controller.destroy())
      controllers = []
    }
  }, [isMobile])

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
            <button
              ref={prevRef}
              className="media-rail__arrow"
              type="button"
              disabled={!canScrollPrev}
              aria-label={`Scroll ${title} back`}
              onClick={() => scrollByPage(-1)}
            >
              <AltArrowLeftIcon size={20} aria-hidden="true" />
            </button>
            <button
              ref={nextRef}
              className="media-rail__arrow"
              type="button"
              disabled={!canScrollNext}
              aria-label={`Scroll ${title} forward`}
              onClick={() => scrollByPage(1)}
            >
              <AltArrowRightIcon size={20} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      <ul className="media-rail__track" ref={trackRef} onScroll={updateScrollState}>
        {items.map((item) => {
          const media = item as PopularMediaItem

          return (
            <li
              className={`media-rail__item${itemClassName ? ` ${itemClassName}` : ''}`}
              key={itemKey ? itemKey(item) : `${media.kind}-${media.id}`}
            >
              {renderItem ? renderItem(item) : <MediaCard item={media} />}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default MediaRail