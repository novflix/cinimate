import { useCallback, useEffect, useState } from 'react'
import { BookmarkIcon } from '@solar-icons/react/bold/bookmark'
import { EyeIcon } from '@solar-icons/react/bold/eye'
import { StarIcon } from '@solar-icons/react/bold/star'
import { Link } from 'react-router-dom'
import { backdropUrl, formatRating, formatVotes } from '@/api/tmdb'
import { useHeroSlides } from '@/hooks/useHeroSlides'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { titlePath } from '@/navigation'
import './HeroBanner.css'

const AUTOPLAY_DELAY = 7000

function HeroBanner() {
  const { slides, error, isLoading } = useHeroSlides()
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  const [{ index, previous }, setSlideState] = useState({ index: 0, previous: -1 })
  const [isPaused, setIsPaused] = useState(false)
  const [cycle, setCycle] = useState(0)

  const goTo = useCallback((next: number) => {
    setSlideState((state) =>
      state.index === next ? state : { index: next, previous: state.index },
    )
    setCycle((value) => value + 1)
  }, [])

  useEffect(() => {
    if (!slides || slides.length < 2 || isPaused || prefersReducedMotion) return

    const timer = window.setInterval(() => {
      setSlideState((state) => ({
        index: (state.index + 1) % slides.length,
        previous: state.index,
      }))
    }, AUTOPLAY_DELAY)

    return () => window.clearInterval(timer)
  }, [slides, isPaused, prefersReducedMotion, cycle])

  useEffect(() => {
    if (!slides || slides.length < 2) return

    const next = slides[(index + 1) % slides.length]
    const image = new Image()
    image.src = backdropUrl(next.backdrop, 'w1280')
  }, [slides, index])

  if (isLoading) {
    return <div className="hero hero--loading" aria-hidden="true" />
  }

  if (error || !slides || slides.length === 0) {
    return (
      <div className="hero hero--error" role="status">
        <p>Featured titles are unavailable right now.</p>
      </div>
    )
  }

  const slide = slides[index]
  const slideKey = `${slide.kind}-${slide.id}`

  return (
    <section
      className="hero"
      aria-roledescription="carousel"
      aria-label="Popular right now"
      onPointerEnter={() => setIsPaused(true)}
      onPointerLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsPaused(false)
        }
      }}
    >
      {slides.map((item, itemIndex) => {
        if (itemIndex !== index && itemIndex !== previous) return null

        const isActive = itemIndex === index

        return (
          <div
            key={`${item.kind}-${item.id}`}
            className={`hero__slide ${isActive ? 'hero__slide--active' : 'hero__slide--leaving'}`}
            aria-hidden={!isActive}
          >
            <img
              src={backdropUrl(item.backdrop, 'w1280')}
              srcSet={`${backdropUrl(item.backdrop, 'w780')} 780w, ${backdropUrl(
                item.backdrop,
                'w1280',
              )} 1280w, ${backdropUrl(item.backdrop, 'original')} 1920w`}
              sizes="(max-width: 768px) 100vw, (max-width: 2000px) 72vw, 1440px"
              alt=""
              loading={itemIndex === 0 ? 'eager' : 'lazy'}
              fetchPriority={isActive ? 'high' : 'auto'}
              decoding="async"
            />
          </div>
        )
      })}

      <div className="hero__shade" aria-hidden="true" />

      <div className="hero__info" key={slideKey}>
        <div className="hero__meta">
          <span className="hero__badge">{slide.kind === 'movie' ? 'Movie' : 'Series'}</span>
          <span className="hero__year">{slide.year}</span>
        </div>

        <h1 className="hero__title">
          <Link className="hero__title-link" to={titlePath(slide.kind, slide.id)}>
            {slide.title}
          </Link>
        </h1>

        <div className="hero__stats">
          <span className="hero__rating">
            <StarIcon size={17} aria-hidden="true" />
            {formatRating(slide.rating)}
            <span className="hero__rating-max">/10</span>
          </span>
          <span className="hero__divider" aria-hidden="true" />
          <span className="hero__reviews">{formatVotes(slide.votes)} reviews</span>
        </div>

        <p className="hero__overview">{slide.overview}</p>

        <div className="hero__actions">
          <button type="button" className="hero__button hero__button--primary">
            <EyeIcon size={18} aria-hidden="true" />
            Watched
          </button>
          <button type="button" className="hero__button hero__button--secondary">
            <BookmarkIcon size={18} aria-hidden="true" />
            Watchlist
          </button>
        </div>
      </div>

      <div className="hero__dots" role="group" aria-label="Choose a slide">
        {slides.map((item, itemIndex) => (
          <button
            key={`${item.kind}-${item.id}`}
            type="button"
            className={`hero__dot${itemIndex === index ? ' hero__dot--active' : ''}`}
            aria-label={`Show ${item.title}`}
            aria-current={itemIndex === index ? 'true' : undefined}
            onClick={() => goTo(itemIndex)}
          />
        ))}
      </div>
    </section>
  )
}

export default HeroBanner