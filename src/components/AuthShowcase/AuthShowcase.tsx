import { useEffect, useRef, type CSSProperties } from 'react'
import { posterUrl, type PopularMediaItem } from '@/api/tmdb'
import SmartImage from '@/components/SmartImage/SmartImage'
import { useTrendingToday } from '@/hooks/useTrendingToday'
import './AuthShowcase.css'

const COLUMNS = 9
const POSTERS_PER_COLUMN = 6
// Seconds for one full loop of each poster column; different speeds keep the wall from looking
// mechanical.
const COLUMN_DURATIONS = [90, 120, 105, 135, 95]

type Poster = PopularMediaItem | null

/** Spreads the trending posters over the columns. Without data the columns hold shimmer tiles. */
function buildColumns(media: PopularMediaItem[] | null): Poster[][] {
  const withPoster = (media ?? []).filter((item) => item.poster)

  return Array.from({ length: COLUMNS }, (_, column) =>
    Array.from({ length: POSTERS_PER_COLUMN }, (_, row) =>
      withPoster.length ? withPoster[(row * COLUMNS + column * 3) % withPoster.length] : null,
    ),
  )
}

/**
 * Desktop background of the auth screens: one slowly moving wall of trending posters that sits
 * behind the whole page (the form card floats over it), so both halves share one scene.
 */
function AuthShowcase() {
  const rootRef = useRef<HTMLDivElement>(null)
  const { media } = useTrendingToday()
  const columns = buildColumns(media)

  // The wall drifts a few pixels against the pointer. Only CSS variables change, so React never
  // re-renders on mouse movement.
  useEffect(() => {
    const root = rootRef.current
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let frame = 0
    const onPointerMove = (event: PointerEvent) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        root.style.setProperty('--mx', String((event.clientX / window.innerWidth - 0.5) * 2))
        root.style.setProperty('--my', String((event.clientY / window.innerHeight - 0.5) * 2))
      })
    }

    window.addEventListener('pointermove', onPointerMove)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onPointerMove)
    }
  }, [])

  return (
    <div ref={rootRef} className="auth-showcase" aria-hidden="true">
      <div className="auth-showcase__wall">
        {columns.map((posters, column) => (
          <div
            key={column}
            className="auth-showcase__column"
            style={{ '--duration': `${COLUMN_DURATIONS[column % COLUMN_DURATIONS.length]}s` } as CSSProperties}
          >
            {/* The set is rendered twice so the loop (translateY -50%) is seamless. */}
            {[0, 1].map((copy) => (
              <div key={copy} className="auth-showcase__set">
                {posters.map((item, row) => (
                  <div
                    key={`${row}-${item?.id ?? 'empty'}`}
                    className={`auth-showcase__poster${item ? '' : ' skeleton'}`}
                  >
                    {item?.poster && <SmartImage src={posterUrl(item.poster)} alt="" />}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="auth-showcase__veil" />
      <div className="auth-showcase__glow" />
    </div>
  )
}

export default AuthShowcase
