import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './CardSheet.css'

export type CardSheetAction = {
  id: string
  label: string
  icon: ReactNode
  /** Marks the action as already applied (e.g. the title is on the watchlist). */
  active?: boolean
  tone?: 'default' | 'warn'
  onSelect: () => void
}

type CardSheetProps = {
  title: string
  subtitle?: string
  actions: CardSheetAction[]
  onClose: () => void
}

/** Phone-only action sheet for a card: one small trigger on the poster instead of three buttons. */
function CardSheet({ title, subtitle, actions, onClose }: CardSheetProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return createPortal(
    <div className="card-sheet" role="presentation">
      <button type="button" className="card-sheet__backdrop" aria-label="Close" onClick={onClose} />
      <div className="card-sheet__panel" role="dialog" aria-label={title}>
        <span className="card-sheet__grip" aria-hidden="true" />
        <div className="card-sheet__head">
          <p className="card-sheet__title">{title}</p>
          {subtitle && <p className="card-sheet__subtitle">{subtitle}</p>}
        </div>
        <ul className="card-sheet__list">
          {actions.map((action) => (
            <li key={action.id}>
              <button
                type="button"
                className={`card-sheet__action${action.active ? ' is-active' : ''}${
                  action.tone === 'warn' ? ' card-sheet__action--warn' : ''
                }`}
                onClick={() => {
                  action.onSelect()
                  onClose()
                }}
              >
                {action.icon}
                {action.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  )
}

export default CardSheet
