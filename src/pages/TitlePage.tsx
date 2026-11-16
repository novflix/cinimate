import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  formatFullDate,
  formatMoney,
  formatRuntime,
  formatVoteCount,
  languageName,
  type TitleDetails,
} from '@/api/details'
import { formatRating, type MediaKind } from '@/api/tmdb'
import { StarIcon } from '@solar-icons/react/bold/star'
import MediaGrid from '@/components/MediaGrid/MediaGrid'
import MediaRail from '@/components/MediaRail/MediaRail'
import PersonCard, { personItemClass } from '@/components/PersonCard/PersonCard'
import { MediaRailSkeleton, Skeleton } from '@/components/Skeleton/Skeleton'
import TitleHero from '@/components/TitleHero/TitleHero'
import { useLibrary } from '@/hooks/useLibrary'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useTitleDetails } from '@/hooks/useTitleDetails'
import { ratingColor } from '@/lib/rating'
import { homePath } from '@/navigation'
import './TitlePage.css'

type Fact = { label: string; value: string }

/** Titles whose similar grid was opened, kept while the app is open so a return lands in place. */
const expandedSimilar = new Set<string>()

/** The user's own score of a watched title, shown next to the TMDB rating in the meta line. */
function UserRating({ details }: { details: TitleDetails }) {
  const { isWatched, getRating } = useLibrary()
  const rating = isWatched(details) ? getRating(details) : null

  if (rating === null) return null

  return (
    <span
      className="title-page__user-rating"
      style={{ '--rating-color': ratingColor(rating) } as CSSProperties}
      aria-label={`Your rating: ${rating} out of 10`}
    >
      <StarIcon size={13} aria-hidden="true" />
      You {rating}
    </span>
  )
}

function buildFacts(details: TitleDetails): Fact[] {
  const isMovie = details.kind === 'movie'

  return [
    { label: 'Status', value: details.status || '—' },
    {
      label: isMovie ? 'Release Date' : 'First Air Date',
      value: formatFullDate(details.releaseDate),
    },
    { label: 'Language', value: languageName(details.language) },
    isMovie
      ? { label: 'Budget', value: formatMoney(details.budget) }
      : { label: 'Seasons', value: details.seasons ? String(details.seasons) : '—' },
    isMovie
      ? { label: 'Revenue', value: formatMoney(details.revenue) }
      : { label: 'Episodes', value: details.episodes ? String(details.episodes) : '—' },
    { label: 'Vote Count', value: formatVoteCount(details.votes) },
  ]
}

function metaParts(details: TitleDetails): string[] {
  return [
    details.year,
    details.runtime ? formatRuntime(details.runtime) : '',
    details.certification ?? '',
    details.kind === 'movie' ? 'Movie' : 'Series',
  ].filter(Boolean)
}

type TitleViewProps = {
  kind: MediaKind
  id: number
}

function TitlePageSkeleton() {
  return (
    <div className="title-page" aria-busy="true">
      <span className="visually-hidden" role="status">
        Loading title details…
      </span>

      <div className="title-hero title-hero--loading" aria-hidden="true" />

      <div className="title-page__body" aria-hidden="true">
        <div className="title-page__summary">
          <div className="title-page__intro">
            <Skeleton className="title-page-skeleton__meta" />
            <Skeleton className="title-page-skeleton__line" />
            <Skeleton className="title-page-skeleton__line title-page-skeleton__line--short" />
          </div>

          <div className="title-page__facts">
            {Array.from({ length: 6 }, (_, index) => (
              <div className="title-page__fact" key={index}>
                <Skeleton className="title-page-skeleton__fact-value" />
                <Skeleton className="title-page-skeleton__fact-label" />
              </div>
            ))}
          </div>
        </div>

        <MediaRailSkeleton />
        <MediaRailSkeleton />
      </div>
    </div>
  )
}

function TitleView({ kind, id }: TitleViewProps) {
  const { details, error, isLoading, reload } = useTitleDetails(kind, id)
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const similarKey = `${kind}-${id}`
  const [showSimilar, setShowSimilar] = useState(() => expandedSimilar.has(similarKey))
  // Only a click scrolls to the grid; a restored open grid must not pull the page away from the
  // position the scroll restorer is about to apply.
  const similarJustOpened = useRef(false)
  const similarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!details) return

    const previous = document.title
    document.title = `${details.title} — Cinimate`

    return () => {
      document.title = previous
    }
  }, [details])

  useEffect(() => {
    if (!showSimilar || !similarJustOpened.current) return
    similarJustOpened.current = false

    similarRef.current?.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'start',
    })
  }, [showSimilar, prefersReducedMotion])

  if (isLoading) {
    return <TitlePageSkeleton />
  }

  if (error || !details) {
    return (
      <div className="title-page">
        <div className="title-page__status" role="status">
          <p>This title is unavailable right now.</p>
          <div className="title-page__status-actions">
            <button type="button" className="title-page__retry" onClick={reload}>
              Try again
            </button>
            <Link className="title-page__home" to={homePath}>
              Back to home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const meta = metaParts(details)
  const hasRating = details.votes > 0 && details.rating > 0

  return (
    <article className="title-page" aria-label={details.title}>
      <TitleHero details={details} />

      <div className="title-page__body">
        <div className="title-page__summary">
          <div className="title-page__intro">
            <p className="title-page__meta">
              <UserRating details={details} />
              {hasRating && (
                <>
                  <span className="title-page__rating">{formatRating(details.rating)}</span>
                  {meta.length > 0 && <span aria-hidden="true">•</span>}
                </>
              )}
              {meta.map((part, index) => (
                <span key={part} className="title-page__meta-part">
                  {index > 0 && <span aria-hidden="true">•</span>}
                  {part}
                </span>
              ))}
            </p>

            {details.overview && <p className="title-page__overview">{details.overview}</p>}
          </div>

          <dl className="title-page__facts">
            {buildFacts(details).map((fact) => (
              <div className="title-page__fact" key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {details.cast.length > 0 && (
          <MediaRail
            title="Cast"
            items={details.cast}
            itemKey={(person) => person.id}
            itemClassName={personItemClass}
            renderItem={(person) => <PersonCard person={person} />}
          />
        )}

        {details.crew.length > 0 && (
          <MediaRail
            title="Crew"
            items={details.crew}
            itemKey={(person) => person.id}
            itemClassName={personItemClass}
            renderItem={(person) => <PersonCard person={person} />}
          />
        )}

        {details.similar.length > 0 && (
          <section className="title-page__similar" aria-label="Similar titles">
            <div className="title-page__similar-action">
              <button
                type="button"
                className="title-page__similar-button"
                aria-expanded={showSimilar}
                onClick={() => {
                  similarJustOpened.current = !showSimilar
                  if (showSimilar) expandedSimilar.delete(similarKey)
                  else expandedSimilar.add(similarKey)
                  setShowSimilar((value) => !value)
                }}
              >
                {showSimilar ? 'Hide Similar' : 'Watch Similar'}
              </button>
            </div>

            {showSimilar && (
              <div className="title-page__similar-list" ref={similarRef}>
                <h2 className="title-page__similar-title">Similar</h2>
                <MediaGrid label="Similar" items={details.similar} />
              </div>
            )}
          </section>
        )}
      </div>
    </article>
  )
}

type TitlePageProps = {
  kind: MediaKind
}

function TitlePage({ kind }: TitlePageProps) {
  const { id } = useParams()
  const numericId = Number(id)

  if (!Number.isInteger(numericId) || numericId <= 0) {
    return (
      <div className="title-page">
        <div className="title-page__status" role="status">
          <p>This title does not exist.</p>
          <Link className="title-page__home" to={homePath}>
            Back to home
          </Link>
        </div>
      </div>
    )
  }

  // One view per title: navigating from a title to a similar one starts from a clean state.
  return <TitleView key={`${kind}-${numericId}`} kind={kind} id={numericId} />
}

export default TitlePage