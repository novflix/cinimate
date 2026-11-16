import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PopularMediaItem } from '@/api/tmdb'
import MediaCard from '@/components/MediaCard/MediaCard'
import { MediaCardSkeleton } from '@/components/Skeleton/Skeleton'
import { gridStyle, useGridLayout } from '@/hooks/useCardGridLayout'
import './ForYouFeed.css'

/** Keep in sync with the `for-you-out` animation in the CSS. */
const LEAVE_MS = 260
/** How long the remaining cards take to glide into the freed place. */
const GLIDE_MS = 440
/** A card counts as seen once this much of it has been on screen. */
const SEEN_THRESHOLD = 0.6

type FeedCardProps = {
  item: PopularMediaItem
  priority: boolean
  dismissed: boolean
  /** False for cards that were already on screen when the feed was restored. */
  entering: boolean
  onDismiss: (item: PopularMediaItem) => void
  onSeen: (item: PopularMediaItem) => void
  /** Called once the fade-out of a hidden card is over, so the feed can close the gap. */
  onLeft: (item: PopularMediaItem) => void
  register: (key: string, node: HTMLLIElement | null) => void
}

const keyOf = (item: PopularMediaItem) => `${item.kind}-${item.id}`

/** A card that fades out when hidden; the feed then removes it and the others glide into place. */
function FeedCard({
  item,
  priority,
  dismissed,
  entering,
  onDismiss,
  onSeen,
  onLeft,
  register,
}: FeedCardProps) {
  const ref = useRef<HTMLLIElement | null>(null)
  const seen = useRef(false)
  const key = keyOf(item)

  const setNode = useCallback(
    (node: HTMLLIElement | null) => {
      ref.current = node
      register(key, node)
    },
    [register, key],
  )

  useEffect(() => {
    if (!dismissed) return

    const timer = window.setTimeout(() => onLeft(item), LEAVE_MS)
    return () => window.clearTimeout(timer)
  }, [dismissed, item, onLeft])

  // Impressions: a title that was really on screen is ranked a little lower next time.
  useEffect(() => {
    const node = ref.current
    if (!node || seen.current || dismissed) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting) || seen.current) return
        seen.current = true
        onSeen(item)
        observer.disconnect()
      },
      { threshold: SEEN_THRESHOLD },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [item, dismissed, onSeen])

  return (
    <li
      ref={setNode}
      className={`for-you-feed__item${entering ? ' for-you-feed__item--entering' : ''}${
        dismissed ? ' for-you-feed__item--leaving' : ''
      }`}
    >
      <MediaCard item={item} priority={priority} onDismiss={() => onDismiss(item)} />
    </li>
  )
}

type ForYouFeedProps = {
  items: PopularMediaItem[]
  isDismissed: (item: PopularMediaItem) => boolean
  onDismiss: (item: PopularMediaItem) => void
  onSeen: (item: PopularMediaItem) => void
  /** Called when the end of the list nears the viewport. */
  onNearEnd: () => void
  /** Shows a row of placeholders under the cards while more are loading. */
  loadingMore: boolean
  /** Stops asking for more. */
  canLoadMore: boolean
}

function ForYouFeed({
  items,
  isDismissed,
  onDismiss,
  onSeen,
  onNearEnd,
  loadingMore,
  canLoadMore,
}: ForYouFeedProps) {
  const listRef = useRef<HTMLUListElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const { columns } = useGridLayout(listRef)

  // Hidden cards that have finished fading out and are removed from the grid. Cards hidden
  // before the user left are dropped straight away instead of fading out again on return.
  const [gone, setGone] = useState<ReadonlySet<string>>(
    () => new Set(items.filter(isDismissed).map(keyOf)),
  )

  // Cards that were already in the feed when it mounted were on screen before the user left.
  // Replaying the entrance animation for them on Back would look like the page scrolled up.
  const [knownKeys] = useState(() => new Set(items.map(keyOf)))

  const dismissedKeys = new Set(items.filter(isDismissed).map(keyOf))
  // Undo brings a card back: forget the removal during render, no extra effect pass needed.
  if ([...gone].some((key) => !dismissedKeys.has(key))) {
    setGone(new Set([...gone].filter((key) => dismissedKeys.has(key))))
  }

  const handleLeft = useCallback((item: PopularMediaItem) => {
    setGone((current) => new Set(current).add(keyOf(item)))
  }, [])

  const visible = items.filter((item) => !gone.has(keyOf(item)))

  // FLIP: when the set of cards changes, every card that stayed is moved back to where it was
  // and then released, so the grid closes the gap with a glide instead of a jump. Layout
  // offsets are used because they ignore transforms, even while a glide is still running.
  const nodes = useRef(new Map<string, HTMLLIElement>())
  const lastPositions = useRef(new Map<string, { x: number; y: number }>())
  const lastSignature = useRef('')
  const gliding = useRef(new WeakMap<Element, Animation>())

  const register = useCallback((key: string, node: HTMLLIElement | null) => {
    if (node) nodes.current.set(key, node)
    else nodes.current.delete(key)
  }, [])

  useLayoutEffect(() => {
    const positions = new Map<string, { x: number; y: number }>()
    nodes.current.forEach((node, key) => {
      positions.set(key, { x: node.offsetLeft, y: node.offsetTop })
    })

    const signature = [...positions.keys()].join(',')
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (signature !== lastSignature.current && !reduceMotion) {
      positions.forEach((position, key) => {
        const before = lastPositions.current.get(key)
        const node = nodes.current.get(key)
        if (!before || !node) return

        const dx = before.x - position.x
        const dy = before.y - position.y
        if (dx === 0 && dy === 0) return

        gliding.current.get(node)?.cancel()
        gliding.current.set(
          node,
          node.animate(
            [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
            { duration: GLIDE_MS, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
          ),
        )
      })
    }

    lastPositions.current = positions
    lastSignature.current = signature
  })

  // Re-created after every page: an observer reports the current state when it starts, so a
  // sentinel that is still on screen after new cards arrived asks for the next page at once.
  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !canLoadMore || loadingMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onNearEnd()
      },
      { rootMargin: '1200px 0px' },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [visible.length, canLoadMore, loadingMore, onNearEnd])

  return (
    <>
      <ul ref={listRef} className="card-grid" style={gridStyle(columns)} aria-label="Recommended for you">
        {columns > 0 &&
          visible.map((item, index) => {
            const key = keyOf(item)

            return (
              <FeedCard
                key={key}
                item={item}
                priority={index < columns}
                dismissed={isDismissed(item)}
                entering={!knownKeys.has(key)}
                onDismiss={onDismiss}
                onSeen={onSeen}
                onLeft={handleLeft}
                register={register}
              />
            )
          })}

        {loadingMore &&
          Array.from({ length: columns * 2 }, (_, index) => (
            <li className="card-grid__item" key={`skeleton-${index}`} aria-hidden="true">
              <MediaCardSkeleton />
            </li>
          ))}
      </ul>

      <div ref={sentinelRef} className="for-you-feed__sentinel" aria-hidden="true" />
    </>
  )
}

export function ForYouSkeleton() {
  const ref = useRef<HTMLUListElement>(null)
  const { columns } = useGridLayout(ref)

  return (
    <ul
      ref={ref}
      className="card-grid card-grid--skeleton"
      style={gridStyle(columns)}
      aria-hidden="true"
    >
      {Array.from({ length: columns * 3 }, (_, index) => (
        <li className="card-grid__item" key={index}>
          <MediaCardSkeleton />
        </li>
      ))}
    </ul>
  )
}

export default ForYouFeed
