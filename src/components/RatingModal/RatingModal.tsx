import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { CloseCircleIcon } from '@solar-icons/react/bold/close-circle'
import { useLibrary } from '@/hooks/useLibrary'
import { titleKey, type RatingSubject } from '@/lib/library'
import {
  MAX_RATING,
  MIN_RATING,
  NEUTRAL_RATING_COLOR,
  clampRating,
  ratingColor,
  ratingLabel,
} from '@/lib/rating'
import './RatingModal.css'

const STEPS = Array.from({ length: MAX_RATING }, (_, index) => index + 1)

/** How long the "saved" confirmation stays before the dialog closes by itself. */
const SAVED_CLOSE_DELAY = 1300

const RING_SIZE = 136
const RING_RADIUS = 60
const RING_LENGTH = 2 * Math.PI * RING_RADIUS

type RatingDialogProps = {
  subject: RatingSubject
  rating: number | null
  onSave: (rating: number) => void
  onClose: () => void
}

function RatingDialog({ subject, rating, onSave, onClose }: RatingDialogProps) {
  const headingId = useId()
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const scaleRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  // Taken once when the dialog opens: saving changes the stored rating, not what we started from.
  const [startRating] = useState(rating)
  const [value, setValue] = useState<number | null>(startRating)
  const [saved, setSaved] = useState(false)

  const color = value === null ? NEUTRAL_RATING_COLOR : ratingColor(value)
  const progress = value === null ? 0 : value / MAX_RATING

  // Modal behaviour: lock the page scroll, move focus in, give it back and close on Escape.
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    scaleRef.current?.focus({ preventScroll: true })

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus?.({ preventScroll: true })
    }
  }, [onClose])

  useEffect(() => {
    if (!saved) return

    const timer = window.setTimeout(onClose, SAVED_CLOSE_DELAY)
    return () => window.clearTimeout(timer)
  }, [saved, onClose])

  const save = () => {
    if (saved) {
      onClose()
      return
    }
    if (value === null) return

    onSave(value)
    setSaved(true)
  }

  // The 10 steps are one slider: tap a step or drag across them to choose.
  const valueAt = (clientX: number): number | null => {
    const rect = scaleRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return null

    return clampRating(Math.floor(((clientX - rect.left) / rect.width) * MAX_RATING) + 1)
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (saved) return

    dragging.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    setValue((current) => valueAt(event.clientX) ?? current)
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    setValue((current) => valueAt(event.clientX) ?? current)
  }

  const stopDragging = () => {
    dragging.current = false
  }

  const onScaleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (saved) return

    if (event.key === 'Enter') {
      event.preventDefault()
      save()
      return
    }

    const current = value ?? 0
    let next: number | null = null

    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = current + 1
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = current - 1
    else if (event.key === 'Home') next = MIN_RATING
    else if (event.key === 'End') next = MAX_RATING
    else if (/^[0-9]$/.test(event.key)) next = event.key === '0' ? MAX_RATING : Number(event.key)

    if (next === null) return
    event.preventDefault()
    setValue(clampRating(next))
  }

  // Keep Tab inside the dialog.
  const onDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return

    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [tabindex="0"]',
    )
    if (!focusable?.length) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const saveLabel = saved ? 'Saved' : startRating === null ? 'Save rating' : 'Update rating'

  return createPortal(
    <div
      className="rating-overlay"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className="rating-dialog"
        style={{ '--rating-color': color } as CSSProperties}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-describedby={subject.title ? titleId : undefined}
        onKeyDown={onDialogKeyDown}
      >
        <header className="rating-dialog__head">
          <div className="rating-dialog__heading">
            <p className="rating-dialog__eyebrow" id={headingId}>
              {saved ? 'Rating saved' : 'How was it?'}
            </p>
            {subject.title && (
              <h2 className="rating-dialog__title" id={titleId}>
                {subject.title}
              </h2>
            )}
          </div>
          <button
            type="button"
            className="rating-dialog__close"
            aria-label="Close"
            onClick={onClose}
          >
            <CloseCircleIcon size={24} aria-hidden="true" />
          </button>
        </header>

        <div className="rating-ring" aria-hidden="true">
          <svg viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
            <circle
              className="rating-ring__track"
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
            />
            <circle
              className={`rating-ring__arc${value === null ? ' rating-ring__arc--empty' : ''}`}
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              strokeDasharray={RING_LENGTH}
              strokeDashoffset={RING_LENGTH * (1 - progress)}
            />
          </svg>
          <div className="rating-ring__value">
            <span className="rating-ring__number" key={value ?? 'none'}>
              {value ?? '–'}
            </span>
            <span className="rating-ring__max">/{MAX_RATING}</span>
          </div>
        </div>

        <p className={`rating-dialog__label${value === null ? ' rating-dialog__label--hint' : ''}`}>
          {value === null ? 'Tap or drag to rate' : ratingLabel(value)}
        </p>

        <div
          ref={scaleRef}
          className="rating-scale"
          role="slider"
          tabIndex={saved ? -1 : 0}
          aria-label={`Your rating${subject.title ? ` for ${subject.title}` : ''}`}
          aria-valuemin={MIN_RATING}
          aria-valuemax={MAX_RATING}
          aria-valuenow={value ?? undefined}
          aria-valuetext={
            value === null ? 'Not rated' : `${value} out of ${MAX_RATING}, ${ratingLabel(value)}`
          }
          aria-disabled={saved}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={stopDragging}
          onPointerCancel={stopDragging}
          onKeyDown={onScaleKeyDown}
        >
          {STEPS.map((step) => {
            const state =
              value === null || step > value
                ? ''
                : step === value
                  ? ' rating-scale__step--current'
                  : ' rating-scale__step--filled'

            return (
              <span key={step} className={`rating-scale__step${state}`} aria-hidden="true">
                {step}
              </span>
            )
          })}
        </div>

        <button
          type="button"
          className="rating-dialog__save"
          disabled={value === null}
          onClick={save}
        >
          {saved && (
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                d="M5 12.5l4.5 4.5L19 7.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          {saveLabel}
        </button>

        <button
          type="button"
          className={`rating-dialog__skip${saved ? ' rating-dialog__skip--hidden' : ''}`}
          tabIndex={saved ? -1 : 0}
          onClick={onClose}
        >
          {startRating === null ? 'Skip' : 'Cancel'}
        </button>

        <p className="visually-hidden" role="status">
          {saved ? 'Rating saved' : ''}
        </p>
      </div>
    </div>,
    document.body,
  )
}

/**
 * Asks the user how a title was, right after they marked it as watched. Rendered once in the app
 * layout; the library context decides when it opens (see `toggleWatched` / `promptRating`).
 */
function RatingModal() {
  const { ratingPrompt, getRating, rateTitle, dismissRatingPrompt } = useLibrary()
  if (!ratingPrompt) return null

  return (
    <RatingDialog
      key={titleKey(ratingPrompt)}
      subject={ratingPrompt}
      rating={getRating(ratingPrompt)}
      onSave={(rating) => rateTitle(ratingPrompt, rating)}
      onClose={dismissRatingPrompt}
    />
  )
}

export default RatingModal
