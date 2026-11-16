import { useLayoutEffect, useRef, useState } from 'react'
import { UserRoundedIcon } from '@solar-icons/react/bold/user-rounded'
import { Link, useParams } from 'react-router-dom'
import { formatMovieCount, formatSeriesCount, type PersonDetails } from '@/api/person'
import { profileUrl } from '@/api/tmdb'
import MediaCard from '@/components/MediaCard/MediaCard'
import { MediaCardSkeleton, Skeleton } from '@/components/Skeleton/Skeleton'
import SmartImage from '@/components/SmartImage/SmartImage'
import { usePersonDetails } from '@/hooks/usePersonDetails'
import { homePath } from '@/navigation'
import './PersonPage.css'

/** Titles shown at first and added by each press of "Show more". Divisible by 2, 3, 4, 6 and 8. */
const PAGE_SIZE = 24
const SKELETON_COUNT = 9

/** How many filmography titles each person had expanded, kept while the app is open. */
const expandedFilmographies = new Map<number, number>()

/** `1950-01-01`, or `1950-01-01 – 2020-02-03` for a person who has died. */
function formatLifespan(person: PersonDetails): string {
  if (!person.birthday) return person.deathday ? `Died ${person.deathday}` : ''
  return person.deathday ? `${person.birthday} – ${person.deathday}` : person.birthday
}

function PersonPhoto({ person }: { person: PersonDetails }) {
  return (
    <div className="person-hero__photo">
      {person.photo ? (
        <SmartImage
          src={profileUrl(person.photo, 'h632')}
          srcSet={`${profileUrl(person.photo, 'w185')} 185w, ${profileUrl(person.photo, 'h632')} 421w`}
          sizes="(max-width: 768px) 110px, 280px"
          alt={person.name}
          fetchPriority="high"
          decoding="async"
        />
      ) : (
        <span className="person-hero__photo-empty" aria-hidden="true">
          <UserRoundedIcon size={40} />
        </span>
      )}
    </div>
  )
}

/** The biography is cut to a few lines, and "Read more" appears only when something is cut. */
function Biography({ text }: { text: string }) {
  const textRef = useRef<HTMLParagraphElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [isCut, setIsCut] = useState(false)

  useLayoutEffect(() => {
    const element = textRef.current
    if (!element || expanded) return

    const measure = () => setIsCut(element.scrollHeight > element.clientHeight + 1)
    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(element)

    return () => observer.disconnect()
  }, [text, expanded])

  return (
    <div className="person-hero__bio">
      <p
        ref={textRef}
        className={`person-hero__bio-text${expanded ? '' : ' person-hero__bio-text--clamped'}`}
      >
        {text}
      </p>
      {(isCut || expanded) && (
        <button
          type="button"
          className="person-hero__bio-toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  )
}

function PersonSkeleton() {
  return (
    <div className="person-page" aria-hidden="true">
      <div className="person-page__body">
        <div className="person-hero">
          <Skeleton className="person-hero__photo person-skeleton__photo" />
          <div className="person-hero__info">
            <Skeleton className="person-skeleton__name" />
            <Skeleton className="person-skeleton__line person-skeleton__line--short" />
            <Skeleton className="person-skeleton__line" />
          </div>
          <div className="person-hero__bio">
            <Skeleton className="person-skeleton__line" />
            <Skeleton className="person-skeleton__line" />
            <Skeleton className="person-skeleton__line person-skeleton__line--short" />
          </div>
        </div>

        <ul className="person-grid">
          {Array.from({ length: SKELETON_COUNT }, (_, index) => (
            <li className="person-grid__item" key={index}>
              <MediaCardSkeleton />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function PersonView({ id }: { id: number }) {
  const { person, error, isLoading, reload } = usePersonDetails(id)
  const [visibleCount, setVisibleCount] = useState(
    () => expandedFilmographies.get(id) ?? PAGE_SIZE,
  )

  const showMore = () => {
    setVisibleCount((count) => {
      const next = count + PAGE_SIZE
      expandedFilmographies.set(id, next)
      return next
    })
  }

  if (isLoading) return <PersonSkeleton />

  if (error || !person) {
    return (
      <div className="person-page">
        <div className="person-page__status" role="status">
          <p>This person is unavailable right now.</p>
          <div className="person-page__status-actions">
            <button type="button" className="person-page__retry" onClick={reload}>
              Try again
            </button>
            <Link className="person-page__home" to={homePath}>
              Back to home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const lifespan = formatLifespan(person)
  const { filmography } = person
  const visible = filmography.slice(0, visibleCount)
  const remaining = filmography.length - visible.length

  return (
    <article className="person-page" aria-label={person.name}>
      <div className="person-page__body">
        <header className="person-hero">
          <PersonPhoto person={person} />

          <div className="person-hero__info">
            <h1 className="person-hero__name">{person.name}</h1>
            {person.department && <p className="person-hero__department">{person.department}</p>}

            {(lifespan || person.birthplace) && (
              <p className="person-hero__meta">
                {lifespan && <span>{lifespan}</span>}
                {person.birthplace && <span>{person.birthplace}</span>}
              </p>
            )}

            {filmography.length > 0 && (
              <p className="person-hero__counts">
                {person.movies > 0 && <span>{formatMovieCount(person.movies)}</span>}
                {person.series > 0 && <span>{formatSeriesCount(person.series)}</span>}
              </p>
            )}
          </div>

          {person.biography && <Biography text={person.biography} />}
        </header>

        {filmography.length > 0 && (
          <section className="person-filmography" aria-labelledby="person-filmography-title">
            <h2 className="person-filmography__title" id="person-filmography-title">
              Filmography
              <span className="person-filmography__count">{filmography.length}</span>
            </h2>

            <ul className="person-grid" aria-label="Filmography">
              {visible.map((item) => (
                <li className="person-grid__item" key={`${item.kind}-${item.id}`}>
                  <MediaCard item={item} showActions={false} />
                </li>
              ))}
            </ul>

            {remaining > 0 && (
              <div className="person-filmography__more">
                <button
                  type="button"
                  className="person-filmography__more-button"
                  onClick={showMore}
                >
                  Show more
                  <span className="person-filmography__more-count">{remaining}</span>
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </article>
  )
}

function PersonPage() {
  const { id } = useParams()
  const numericId = Number(id)

  if (!Number.isInteger(numericId) || numericId <= 0) {
    return (
      <div className="person-page">
        <div className="person-page__status" role="status">
          <p>This person does not exist.</p>
          <Link className="person-page__home" to={homePath}>
            Back to home
          </Link>
        </div>
      </div>
    )
  }

  // One view per person: navigating from a title to another person starts from a clean state.
  return <PersonView key={numericId} id={numericId} />
}

export default PersonPage