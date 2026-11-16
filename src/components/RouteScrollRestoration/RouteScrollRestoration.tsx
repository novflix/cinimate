import { useEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

/** Scroll offset per history entry, so Back and Forward return to the same place. */
const positions = new Map<string, number>()

/** Content can arrive late; keep re-applying the target for a moment while the page grows. */
const RETRY_DELAYS = [0, 60, 160, 320, 650, 1100, 1800, 2600, 3600]
const RESTORE_TIMEOUT_MS = 5000

function isScrollKey(event: KeyboardEvent): boolean {
  return (
    event.key === 'ArrowUp' ||
    event.key === 'ArrowDown' ||
    event.key === 'PageUp' ||
    event.key === 'PageDown' ||
    event.key === 'Home' ||
    event.key === 'End' ||
    event.key === ' '
  )
}

/**
 * Remembers the scroll position of every history entry and restores it on Back/Forward.
 * New pages start at the top, while tab and search-param updates (which replace the current
 * entry) keep the user where they are.
 */
function RouteScrollRestoration() {
  const location = useLocation()
  const navigationType = useNavigationType()
  const previousPath = useRef<string | null>(null)
  const previousKey = useRef<string | null>(null)

  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'
  }, [])

  // Follow the current entry while it is open. The position is saved on every scroll rather
  // than when the effect is cleaned up: by then the next page is already in the DOM and the
  // browser may have clamped the old offset to its shorter height.
  useEffect(() => {
    const key = location.key
    const save = () => positions.set(key, window.scrollY)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') save()
    }

    window.addEventListener('scroll', save, { passive: true })
    window.addEventListener('pagehide', save)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.removeEventListener('scroll', save)
      window.removeEventListener('pagehide', save)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [location.key])

  useEffect(() => {
    const key = location.key
    const outgoingKey = previousKey.current
    const samePath = previousPath.current === location.pathname
    previousKey.current = key
    previousPath.current = location.pathname

    // A tab or search-param change replaces the entry but is still the same page, so the new
    // entry inherits the offset the user had before it.
    if (navigationType === 'REPLACE' && samePath) {
      const offset = outgoingKey === null ? window.scrollY : positions.get(outgoingKey)
      positions.set(key, offset ?? window.scrollY)
      return
    }

    const saved = navigationType === 'POP' ? positions.get(key) : undefined
    if (saved === undefined || saved <= 0) {
      window.scrollTo(0, 0)
      positions.set(key, 0)
      return
    }

    let cancelled = false
    let observer: ResizeObserver | null = null
    let retries: number[] = []
    let stopTimer = 0

    const apply = () => {
      if (!cancelled) window.scrollTo(0, saved)
    }

    const stop = () => {
      if (cancelled) return
      cancelled = true
      retries.forEach((retry) => window.clearTimeout(retry))
      window.clearTimeout(stopTimer)
      observer?.disconnect()

      window.removeEventListener('wheel', stop)
      window.removeEventListener('touchstart', stop)
      window.removeEventListener('pointerdown', stop)
      window.removeEventListener('keydown', onKeyDown)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (isScrollKey(event)) stop()
    }

    retries = RETRY_DELAYS.map((delay) => window.setTimeout(apply, delay))
    stopTimer = window.setTimeout(stop, RESTORE_TIMEOUT_MS)

    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(apply)
      observer.observe(document.body)
    }

    // A real scroll or click means the user took over; do not pull the page back.
    window.addEventListener('wheel', stop, { passive: true })
    window.addEventListener('touchstart', stop, { passive: true })
    window.addEventListener('pointerdown', stop)
    window.addEventListener('keydown', onKeyDown)

    apply()

    return stop
  }, [location.key, location.pathname, navigationType])

  return null
}

export default RouteScrollRestoration
