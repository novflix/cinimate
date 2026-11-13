import { useState } from 'react'
import { BookmarkIcon } from '@solar-icons/react/bold/bookmark'
import { EyeIcon } from '@solar-icons/react/bold/eye'
import { StarIcon } from '@solar-icons/react/bold/star'
import { formatRating, posterUrl, type PopularMediaItem } from '@/api/tmdb'
import './MediaCard.css'

type MediaCardProps = {
  item: PopularMediaItem
}

function MediaCard({ item }: MediaCardProps) {
  const [watched, setWatched] = useState(false)
  const [watchlisted, setWatchlisted] = useState(false)
  // Cards are portrait, so the poster is the primary artwork; backdrop is only a fallback.
  const imagePath = item.poster ?? item.backdrop

  return (
    <article className="media-card">
      <div className="media-card__image-wrap">
        {imagePath ? (
          <img
            className="media-card__image"
            src={posterUrl(imagePath, 'w342')}
            srcSet={`${posterUrl(imagePath, 'w185')} 185w, ${posterUrl(imagePath, 'w342')} 342w, ${posterUrl(
              imagePath,
              'w500',
            )} 500w`}
            sizes="(max-width: 768px) 44vw, 205px"
            alt=""
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="media-card__image media-card__image--placeholder" aria-hidden="true" />
        )}
        <div className="media-card__actions">
          <button
            className={`media-card__action${watched ? ' media-card__action--active' : ''}`}
            type="button"
            aria-label={watched ? `Mark ${item.title} as unwatched` : `Mark ${item.title} as watched`}
            aria-pressed={watched}
            onClick={() => setWatched((value) => !value)}
          >
            <EyeIcon size={18} aria-hidden="true" />
          </button>
          <button
            className={`media-card__action${watchlisted ? ' media-card__action--active' : ''}`}
            type="button"
            aria-label={
              watchlisted
                ? `Remove ${item.title} from the watchlist`
                : `Add ${item.title} to the watchlist`
            }
            aria-pressed={watchlisted}
            onClick={() => setWatchlisted((value) => !value)}
          >
            <BookmarkIcon size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
      <h3 className="media-card__title">{item.title}</h3>
      <div className="media-card__meta">
        <span className="media-card__rating">
          <StarIcon size={14} aria-hidden="true" />
          {formatRating(item.rating)}
        </span>
        {item.year && <span className="media-card__year">{item.year}</span>}
      </div>
    </article>
  )
}

export default MediaCard
