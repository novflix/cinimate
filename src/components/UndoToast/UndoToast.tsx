import { useEffect } from 'react'
import './UndoToast.css'

type UndoToastProps = {
  message: string
  actionLabel?: string
  onAction: () => void
  onClose: () => void
  /** How long the toast stays, in milliseconds. */
  duration?: number
}

function UndoToast({ message, actionLabel = 'Undo', onAction, onClose, duration = 6000 }: UndoToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, duration)
    return () => window.clearTimeout(timer)
  }, [message, duration, onClose])

  return (
    <div className="undo-toast" role="status" aria-live="polite">
      <span className="undo-toast__message">{message}</span>
      <button className="undo-toast__action" type="button" onClick={onAction}>
        {actionLabel}
      </button>
    </div>
  )
}

export default UndoToast
