import { useEffect, useRef } from 'react'
import { BookmarkIcon } from '@solar-icons/react/bold/bookmark'
import { EyeIcon } from '@solar-icons/react/bold/eye'
import { StarIcon } from '@solar-icons/react/bold/star'
import { Link } from 'react-router-dom'
import { prefetchTitle } from '@/api/preload'
import {
  formatDaysUntil,
  formatRating,
  formatReleaseDate,
  posterUrl,
  type PopularMediaItem,
} from '@/api/tmdb'
import SmartImage from '@/components/SmartImage/SmartImage'
import { useLibrary } from '@/hooks/useLibrary'
import { titlePath } from '@/navigation'
import './MediaCard.css'

type MediaCardProps = {
  item: PopularMediaItem
  /**
   * `upcoming` swaps the rating and year for the release date and a days-left countdown, and
   * keeps only the watchlist button: a title that is not out yet cannot be marked as watched.
   */
  variant?: 'default' | 'upcoming'
  /** Above-the-fold cards load eagerly instead of waiting for the lazy-load threshold. */
  priority?: boolean
  /** Hide the watched / watchlist buttons, e.g. on the profile where the lists are only shown. */
  showActions?: boolean
}

const HOVER_INTENT_DELAY = 150

function MediaCard({
  item,
  variant = 'default',
  priority = false,
  showActions = true,
}: MediaCardProps) {
  const { isWatched, isWatchlisted, toggleWatched, toggleWatchlist } = useLibrary()
  const watched = isWatched(item)
  const watchlisted = isWatchlisted(item)
  // Cards are portrait, so the poster is the primary artwork; backdrop is only a fallback.
  const imagePath = item.poster ?? item.backdrop

  // Hovering is only a hint: wait briefly so sweeping the pointer across a rail does not start
  // a detail request for every card it crosses.
  const intentTimer = useRef<number | null>(null)

  const cancelIntent = () => {
    if (intentTimer.current === null) return
    window.clearTimeout(intentTimer.current)
    intentTimer.current = null
  }

  const warmTitle = () => {
    cancelIntent()
    prefetchTitle(item.kind, item.id, { backdrop: item.backdrop, poster: item.poster })
  }

  const warmTitleSoon = () => {
    if (intentTimer.current !== null) return
    intentTimer.current = window.setTimeout(warmTitle, HOVER_INTENT_DELAY)
  }

  useEffect(() => cancelIntent, [])

  return (
    <article
      className="media-card"
      onPointerEnter={warmTitleSoon}
      onPointerLeave={cancelIntent}
      onFocusCapture={warmTitle}
      onBlurCapture={cancelIntent}
    >
      <div className="media-card__image-wrap">
        {imagePath ? (
          <SmartImage
            className="media-card__image"
            src={posterUrl(imagePath, 'w342')}
            srcSet={`${posterUrl(imagePath, 'w185')} 185w, ${posterUrl(imagePath, 'w342')} 342w, ${posterUrl(
              imagePath,
              'w500',
            )} 500w`}
            sizes="(max-width: 768px) 44vw, 205px"
            alt=""
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            decoding="async"
          />
        ) : (
          <div className="media-card__image media-card__image--placeholder" aria-hidden="true" />
        )}
        {showActions && (
          <div className="media-card__actions">
            {variant !== 'upcoming' && (
              <button
                className={`media-card__action${watched ? ' media-card__action--active' : ''}`}
                type="button"
                aria-label={watched ? `Mark ${item.title} as unwatched` : `Mark ${item.title} as watched`}
                aria-pressed={watched}
                onClick={() => toggleWatched(item)}
              >
                <EyeIcon size={18} aria-hidden="true" />
              </button>
            )}
            <button
              className={`media-card__action${watchlisted ? ' media-card__action--active' : ''}`}
              type="button"
              aria-label={
                watchlisted
                  ? `Remove ${item.title} from the watchlist`
                  : `Add ${item.title} to the watchlist`
              }
              aria-pressed={watchlisted}
              onClick={() => toggleWatchlist(item)}
            >
              <BookmarkIcon size={18} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
      <h3 className="media-card__title">
        <Link className="media-card__link" to={titlePath(item.kind, item.id)}>
          {item.title}
        </Link>
      </h3>
      <div className="media-card__meta">
        {variant === 'upcoming' && item.releaseDate ? (
          <>
            <span className="media-card__date">{formatReleaseDate(item.releaseDate)}</span>
            <span className="media-card__countdown">{formatDaysUntil(item.releaseDate)}</span>
          </>
        ) : (
          <>
            <span className="media-card__rating">
              <StarIcon size={14} aria-hidden="true" />
              {formatRating(item.rating)}
            </span>
            {item.year && <span className="media-card__year">{item.year}</span>}
          </>
        )}
      </div>
    </article>
  )
}

export default MediaCard