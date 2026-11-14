import { prefetchTitleDetails } from '@/api/details'
import type { Resource } from '@/api/resource'
import {
  backdropUrl,
  classicMediaResource,
  comingSoonMediaResource,
  newReleasesMediaResource,
  nowPlayingMediaResource,
  popularMediaResource,
  posterUrl,
  type MediaKind,
} from '@/api/tmdb'

export type FeedId = 'popular' | 'now-playing' | 'coming-soon' | 'classic' | 'new-releases'

// The order also decides what gets warmed first once the page is idle.
const FEED_ORDER: readonly FeedId[] = [
  'popular',
  'now-playing',
  'coming-soon',
  'classic',
  'new-releases',
]

const feedIds = new Set<string>(FEED_ORDER)

export function isFeedId(value: string): value is FeedId {
  return feedIds.has(value)
}

const feedResources: Record<FeedId, Resource<unknown>> = {
  popular: popularMediaResource,
  'now-playing': nowPlayingMediaResource,
  'coming-soon': comingSoonMediaResource,
  classic: classicMediaResource,
  'new-releases': newReleasesMediaResource,
}

type NetworkInformation = {
  saveData?: boolean
  effectiveType?: string
}

function networkInformation(): NetworkInformation | undefined {
  return (navigator as Navigator & { connection?: NetworkInformation }).connection
}

/** Respects data-saver mode and very slow connections for purely speculative loading. */
export function canPrefetchInBackground(): boolean {
  if (typeof navigator === 'undefined' || !navigator.onLine) return false

  const connection = networkInformation()
  if (!connection) return true
  if (connection.saveData) return false

  return connection.effectiveType !== 'slow-2g' && connection.effectiveType !== '2g'
}

/** Warms a feed before the user opens its tab. Safe to call on hover/focus. */
export function prefetchFeed(id: FeedId): void {
  void feedResources[id].prefetch()
}

let feedPrefetchStarted = false

/**
 * After the home page is interactive, quietly warms the remaining tabs one by one. Each resource
 * de-duplicates requests, so opening a tab while this runs simply joins the request in flight.
 */
export function scheduleFeedPrefetch(): void {
  if (feedPrefetchStarted || !canPrefetchInBackground()) return
  feedPrefetchStarted = true

  whenIdle(() => {
    void (async () => {
      for (const id of FEED_ORDER) {
        if (!canPrefetchInBackground()) return

        await feedResources[id].prefetch()
        await wait(400)
      }
    })()
  }, 2500)
}

const preloadedImages = new Set<string>()

/** Starts an image download once and remembers it, so repeated hovers do nothing. */
export function preloadImage(url: string | null | undefined): void {
  if (!url || preloadedImages.has(url)) return

  preloadedImages.add(url)

  const image = new Image()
  image.decoding = 'async'
  image.onload = () => preloadedImages.add(url)
  image.onerror = () => preloadedImages.delete(url)
  image.src = url
}

export function preloadBackdrop(
  path: string | null | undefined,
  size: 'w780' | 'w1280' | 'original' = 'w1280',
): void {
  if (path) preloadImage(backdropUrl(path, size))
}

/**
 * Card hover/focus intent: fetch the title page payload and its hero image so the detail page
 * opens with everything already cached.
 */
export function prefetchTitle(
  kind: MediaKind,
  id: number,
  artwork: { backdrop?: string | null; poster?: string | null } = {},
): void {
  void prefetchTitleDetails(kind, id)

  if (artwork.backdrop) {
    preloadBackdrop(artwork.backdrop)
  } else if (artwork.poster) {
    // The title page falls back to the poster when there is no backdrop.
    preloadImage(posterUrl(artwork.poster, 'w500'))
  }
}

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
}

function whenIdle(callback: () => void, timeout: number): void {
  if (typeof window === 'undefined') return

  const idleWindow = window as IdleWindow
  if (typeof idleWindow.requestIdleCallback === 'function') {
    idleWindow.requestIdleCallback(callback, { timeout })
    return
  }

  window.setTimeout(callback, 400)
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}
