import { BookmarkIcon } from '@solar-icons/react/bold/bookmark'
import { EyeIcon } from '@solar-icons/react/bold/eye'
import { StarsIcon } from '@solar-icons/react/bold/stars'
import './TasteSetup.css'

type TasteSetupProps = {
  /** Titles the user has already watched, rated or saved. */
  count: number
  /** How many are needed to unlock the feed. */
  required: number
}

/** "3 titles" / "1 title" */
const titles = (n: number) => `${n} ${n === 1 ? 'title' : 'titles'}`

/**
 * Shown on the For You page instead of the feed until the user has told the app enough about
 * their taste. The progress updates live as titles are marked on the cards below.
 */
function TasteSetup({ count, required }: TasteSetupProps) {
  const done = Math.min(count, required)
  const remaining = Math.max(0, required - count)

  return (
    <section className="taste-setup" aria-labelledby="taste-setup-title">
      <div className="taste-setup__glow" aria-hidden="true" />

      <div className="taste-setup__badge">
        <StarsIcon size={16} aria-hidden="true" />
        Personal feed
      </div>

      <h2 className="taste-setup__title" id="taste-setup-title">
        Teach Cinimate your taste
      </h2>

      <p className="taste-setup__text">
        Add <strong>{remaining > 0 ? titles(remaining) : 'a few more titles'}</strong> to unlock
        recommendations picked just for you. The more you add and rate, the sharper they get.
      </p>

      <div
        className="taste-setup__progress"
        role="progressbar"
        aria-label="Titles added for recommendations"
        aria-valuemin={0}
        aria-valuemax={required}
        aria-valuenow={done}
      >
        <div className="taste-setup__segments" aria-hidden="true">
          {Array.from({ length: required }, (_, index) => (
            <span
              className={`taste-setup__segment${index < done ? ' taste-setup__segment--filled' : ''}`}
              key={index}
            />
          ))}
        </div>

        <span className="taste-setup__count" aria-hidden="true">
          <strong>{done}</strong> / {required}
        </span>
      </div>

      <ul className="taste-setup__steps">
        <li className="taste-setup__step">
          <span className="taste-setup__step-icon">
            <EyeIcon size={18} aria-hidden="true" />
          </span>
          <span>
            <strong>Mark what you have watched</strong> and rate it: ratings teach the feed the
            most.
          </span>
        </li>
        <li className="taste-setup__step">
          <span className="taste-setup__step-icon">
            <BookmarkIcon size={18} aria-hidden="true" />
          </span>
          <span>
            <strong>Save what you want to watch</strong> to your watchlist.
          </span>
        </li>
      </ul>
    </section>
  )
}

export default TasteSetup
