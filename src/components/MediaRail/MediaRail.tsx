import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import CarouselArrow from '@/components/CarouselArrow/CarouselArrow'
import MediaCard from '@/components/MediaCard/MediaCard'
import { MediaCardSkeleton } from '@/components/Skeleton/Skeleton'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import type { PopularMediaItem } from '@/api/tmdb'
import './MediaRail.css'

// Cards mounted before the rail is scrolled: enough to fill the row and show the next one.
const INITIAL_CARDS_DESKTOP = 8
const INITIAL_CARDS_MOBILE = 6
// The rest are added in small batches while the browser is idle, never in the opening commit.
const IDLE_BATCH = 4
// A rail this close to the viewport mounts its cards; the rest wait below the fold.
const RAIL_MARGIN = '300px 0px'
// Placeholder rows keep the page height stable while a rail waits below the fold.
const PLACEHOLDER_CARDS = 7

type MediaRailProps<T> = {
  title: string
  items: T[]
  /** Renders one item. Without it every item is a `MediaCard`, so `items` must be media items. */
  renderItem?: (item: T) => ReactNode
  itemKey?: (item: T) => string | number
  /** Extra class for the item wrapper, e.g. to give people cards their own width. */
  itemClassName?: string
  /** Above-the-fold rail: its cards mount right away and the first posters load eagerly. */
  priority?: boolean
}

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
  cancelIdleCallback?: (handle: number) => void
}

/** Runs `callback` once the browser is idle. Returns a cleanup that cancels the pending call. */
function whenIdle(callback: () => void, timeout: number): () => void {
  const idleWindow = window as IdleWindow
  let cancelled = false

  const run = () => {
    if (cancelled) return
    callback()
  }

  if (typeof idleWindow.requestIdleCallback === 'function') {
    const handle = idleWindow.requestIdleCallback(run, { timeout })
    return () => {
      cancelled = true
      idleWindow.cancelIdleCallback?.(handle)
    }
  }

  const timer = window.setTimeout(run, 200)
  return () => {
    cancelled = true
    window.clearTimeout(timer)
  }
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
  const sectionRef = useRef<HTMLElement>(null)
  const trackRef = useRef<HTMLUListElement>(null)
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)

  const initialCards = isMobile ? INITIAL_CARDS_MOBILE : INITIAL_CARDS_DESKTOP
  // The first rail of a feed sits above the fold and renders at once. Mounting every card of every
  // rail in the same commit is what made opening the home feed pause for a noticeable moment.
  const [mounted, setMounted] = useState(priority)
  const [cardCount, setCardCount] = useState(initialCards)

  useEffect(() => {
    if (mounted) return

    const section = sectionRef.current
    let observer: IntersectionObserver | null = null

    if (!section || typeof IntersectionObserver === 'undefined') {
      setMounted(true)
    } else {
      observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return
          setMounted(true)
          observer?.disconnect()
        },
        { rootMargin: RAIL_MARGIN },
      )
      observer.observe(section)
    }

    // Cards that never scroll into view still have to reach the DOM for screen readers and find.
    const stopIdle = whenIdle(() => setMounted(true), 1000)

    return () => {
      observer?.disconnect()
      stopIdle()
    }
  }, [mounted])

  // React commits are not time-sliced, so the cards that are not on screen yet are added in small
  // idle batches. The whole rail is still in the DOM shortly after it opens, which keeps the
  // content available to screen readers and the browser's find.
  useEffect(() => {
    if (!mounted || cardCount >= items.length) return

    return whenIdle(
      () => setCardCount((count) => Math.min(count + IDLE_BATCH, items.length)),
      500,
    )
  }, [mounted, cardCount, items.length])

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
  }, [items, cardCount, updateScrollState])

  const scrollByPage = (direction: 1 | -1) => {
    const track = trackRef.current
    if (!track) return

    track.scrollBy({ left: track.clientWidth * 0.8 * direction, behavior: 'smooth' })
  }

  const itemClass = `media-rail__item${itemClassName ? ` ${itemClassName}` : ''}`

  return (
    <section className="media-rail" aria-labelledby={headingId} ref={sectionRef}>
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
        {mounted
          ? items.slice(0, cardCount).map((item, index) => {
              const media = item as PopularMediaItem

              return (
                <li
                  className={itemClass}
                  key={itemKey ? itemKey(item) : `${media.kind}-${media.id}`}
                >
                  {renderItem ? (
                    renderItem(item)
                  ) : (
                    <MediaCard item={media} priority={priority && index < 5} />
                  )}
                </li>
              )
            })
          : items.length > 0 &&
            Array.from({ length: PLACEHOLDER_CARDS }, (_, index) => (
              <li className={itemClass} key={`placeholder-${index}`} aria-hidden="true">
                <MediaCardSkeleton />
              </li>
            ))}
      </ul>
    </section>
  )
}

export default MediaRail
