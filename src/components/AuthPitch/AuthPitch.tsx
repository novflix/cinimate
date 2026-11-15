import type { CSSProperties } from 'react'
import { formatRating } from '@/api/tmdb'
import logo from '@/assets/logo.svg'
import { useTrendingToday } from '@/hooks/useTrendingToday'
import './AuthPitch.css'

const WORDS = ['Watch.', 'Track.', 'Discover.']

/** Desktop-only text block to the left of the form card. */
function AuthPitch() {
  const { media } = useTrendingToday()
  const featured = (media ?? []).filter((item) => item.rating > 0).slice(0, 2)

  return (
    <section className="auth-pitch" aria-label="About Cinimate">
      <img className="auth-pitch__logo" src={logo} alt="Cinimate" />

      <h2 className="auth-pitch__headline">
        {WORDS.map((word, index) => (
          <span key={word} className="auth-pitch__word" style={{ '--i': index } as CSSProperties}>
            {word}
          </span>
        ))}
      </h2>

      <p className="auth-pitch__text">
        Your movies and series in one place, with recommendations that actually fit your taste.
      </p>

      {featured.length > 0 && (
        <ul className="auth-pitch__chips" aria-label="Trending today">
          {featured.map((item, index) => (
            <li
              key={`${item.kind}-${item.id}`}
              className="auth-pitch__chip"
              style={{ '--i': index } as CSSProperties}
            >
              <span className="auth-pitch__chip-label">Trending today</span>
              <span className="auth-pitch__chip-title">{item.title}</span>
              <span className="auth-pitch__chip-rating">★ {formatRating(item.rating)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default AuthPitch
