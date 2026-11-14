import './FeedStatus.css'

type FeedStatusProps = {
  message: string
  onRetry?: () => void
}

function FeedStatus({ message, onRetry }: FeedStatusProps) {
  return (
    <div className="feed-status" role="status">
      <p>{message}</p>

      {onRetry && (
        <button type="button" className="feed-status__retry" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}

export default FeedStatus
