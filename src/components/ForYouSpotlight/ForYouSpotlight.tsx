import { useEffect, useRef } from 'react'
import { BookmarkIcon } from '@solar-icons/react/bold/bookmark'
import { EyeClosedIcon } from '@solar-icons/react/bold/eye-closed'
import { EyeIcon } from '@solar-icons/react/bold/eye'
import { StarIcon } from '@solar-icons/react/bold/star'
import { StarsIcon } from '@solar-icons/react/bold/stars'
import { Link } from 'react-router-dom'
import { backdropUrl, formatRating, posterUrl, type PopularMediaItem } from '@/api/tmdb'
import SmartImage from '@/components/SmartImage/SmartImage'
import { useLibrary } from '@/hooks/useLibrary'
import { titlePath } from '@/navigation'
import './ForYouSpotlight.css'

type ForYouSpotlightProps = {
  item: PopularMediaItem
  onDismiss: (item: PopularMediaItem) => void
  onSeen: (item: PopularMediaItem) => void
}

/** The best match of the feed, shown large so the page has a clear first thing to look at. */
function ForYouSpotlight({ item, onDismiss, onSeen }: ForYouSpotlightProps) {
  const { isWatched, isWatchlisted, toggleWatched, toggleWatchlist } = useLibrary()
  const ref = useRef<HTMLElement>(null)
  const watched = isWatched(item)
  const watchlisted = isWatchlisted(item)
  const kindLabel = item.kind === 'movie' ? 'Movie' : 'Series'

  useEffect(() => {
    const node = ref.current
    if (!node) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        onSeen(item)
        observer.disconnect()
      },
      { threshold: 0.6 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [item, onSeen])

  return (
    <article className="spotlight" ref={ref} aria-label="Top pick for you">
      <div className="spotlight__art" aria-hidden="true">
        {item.backdrop ? (
          <SmartImage
            className="spotlight__image"
            src={backdropUrl(item.backdrop, 'w1280')}
            alt=""
            fetchPriority="high"
            decoding="async"
          />
        ) : item.poster ? (
          <SmartImage
            className="spotlight__image spotlight__image--poster"
            src={posterUrl(item.poster, 'w500')}
            alt=""
            decoding="async"
          />
        ) : null}
      </div>
      <div className="spotlight__shade" aria-hidden="true" />

      <div className="spotlight__body">
        <span className="spotlight__label">
          <StarsIcon size={14} aria-hidden="true" />
          Top pick for you
        </span>

        <h2 className="spotlight__title">
          <Link className="spotlight__link" to={titlePath(item.kind, item.id)}>
            {item.title}
          </Link>
        </h2>

        <div className="spotlight__meta">
          <span className="spotlight__rating">
            <StarIcon size={15} aria-hidden="true" />
            {formatRating(item.rating)}
          </span>
          {item.year && <span>{item.year}</span>}
          <span>{kindLabel}</span>
        </div>

        <div className="spotlight__actions">
          <button
            type="button"
            className={`spotlight__button spotlight__button--primary${watchlisted ? ' is-on' : ''}`}
            aria-pressed={watchlisted}
            onClick={() => toggleWatchlist(item)}
          >
            <BookmarkIcon size={18} aria-hidden="true" />
            {watchlisted ? 'In watchlist' : 'Add to watchlist'}
          </button>
          <button
            type="button"
            className={`spotlight__button${watched ? ' is-on' : ''}`}
            aria-pressed={watched}
            aria-label={watched ? 'Mark as unwatched' : 'Mark as watched'}
            onClick={() => toggleWatched(item)}
          >
            <EyeIcon size={18} aria-hidden="true" />
            <span className="spotlight__button-text">{watched ? 'Watched' : 'Mark watched'}</span>
          </button>
          <button
            type="button"
            className="spotlight__icon"
            aria-label={`Not interested in ${item.title}`}
            title="Not interested"
            onClick={() => onDismiss(item)}
          >
            <EyeClosedIcon size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  )
}

export default ForYouSpotlight
