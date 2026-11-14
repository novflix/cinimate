import { useEffect, useRef, useState } from 'react'
import { ArrowRightUpIcon } from '@solar-icons/react/bold/arrow-right-up'
import { BookmarkIcon } from '@solar-icons/react/bold/bookmark'
import { EyeIcon } from '@solar-icons/react/bold/eye'
import { LinkRoundIcon } from '@solar-icons/react/bold/link-round'
import { MenuDotsVerticalIcon } from '@solar-icons/react/bold/menu-dots-vertical'
import { AltArrowLeftIcon } from '@solar-icons/react/linear/alt-arrow-left'
import { useLocation, useNavigate } from 'react-router-dom'
import { backdropUrl, daysUntil, posterUrl } from '@/api/tmdb'
import type { TitleDetails } from '@/api/details'
import './TitleHero.css'

type TitleHeroProps = {
  details: TitleDetails
}

function TitleHero({ details }: TitleHeroProps) {
  const navigate = useNavigate()
  const location = useLocation()

  const [watched, setWatched] = useState(false)
  const [watchlisted, setWatchlisted] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const copiedTimer = useRef<number | undefined>(undefined)

  // A title that is not out yet cannot be marked as watched.
  const isUnreleased = details.releaseDate !== '' && daysUntil(details.releaseDate) > 0

  useEffect(() => {
    if (!menuOpen) return

    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  useEffect(() => () => window.clearTimeout(copiedTimer.current), [])

  // `key` is "default" for the first entry of the session, i.e. there is nothing to go back to.
  const goBack = () => {
    if (location.key !== 'default') navigate(-1)
    else navigate('/')
  }

  const copyLink = () => {
    void navigator.clipboard?.writeText(window.location.href)
    setCopied(true)
    window.clearTimeout(copiedTimer.current)
    copiedTimer.current = window.setTimeout(() => {
      setCopied(false)
      setMenuOpen(false)
    }, 1200)
  }

  const imagePath = details.backdrop ?? details.poster

  return (
    <header className="title-hero">
      {imagePath ? (
        <img
          className="title-hero__image"
          src={
            details.backdrop
              ? backdropUrl(details.backdrop, 'w1280')
              : posterUrl(imagePath, 'w500')
          }
          srcSet={
            details.backdrop
              ? `${backdropUrl(details.backdrop, 'w780')} 780w, ${backdropUrl(
                  details.backdrop,
                  'w1280',
                )} 1280w, ${backdropUrl(details.backdrop, 'original')} 1920w`
              : undefined
          }
          sizes="(max-width: 768px) 100vw, (max-width: 2000px) 72vw, 1440px"
          alt=""
          fetchPriority="high"
          decoding="async"
        />
      ) : null}

      <div className="title-hero__shade" aria-hidden="true" />

      <div className="title-hero__top">
        <button
          type="button"
          className="title-hero__circle"
          aria-label="Go back"
          onClick={goBack}
        >
          <AltArrowLeftIcon size={24} aria-hidden="true" />
        </button>

        <div className="title-hero__menu" ref={menuRef}>
          <button
            type="button"
            className="title-hero__circle"
            aria-label="More actions"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <MenuDotsVerticalIcon size={22} aria-hidden="true" />
          </button>

          {menuOpen && (
            <div className="title-hero__popover" role="menu">
              <button
                type="button"
                role="menuitem"
                className="title-hero__menu-item"
                onClick={copyLink}
              >
                <LinkRoundIcon size={18} aria-hidden="true" />
                {copied ? 'Link copied' : 'Copy link'}
              </button>
              <a
                role="menuitem"
                className="title-hero__menu-item"
                href={details.tmdbUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenuOpen(false)}
              >
                <ArrowRightUpIcon size={18} aria-hidden="true" />
                Open on TMDB
              </a>
            </div>
          )}
        </div>
      </div>

      <div className="title-hero__info">
        <h1 className="title-hero__title">{details.title}</h1>

        <div className="title-hero__actions">
          {!isUnreleased && (
            <button
              type="button"
              className={`title-hero__button${watched ? ' title-hero__button--active' : ''}`}
              aria-pressed={watched}
              onClick={() => setWatched((value) => !value)}
            >
              <EyeIcon size={20} aria-hidden="true" />
              Watched
            </button>
          )}
          <button
            type="button"
            className={`title-hero__button${watchlisted ? ' title-hero__button--active' : ''}`}
            aria-pressed={watchlisted}
            onClick={() => setWatchlisted((value) => !value)}
          >
            <BookmarkIcon size={20} aria-hidden="true" />
            Watchlist
          </button>
        </div>
      </div>
    </header>
  )
}

export default TitleHero