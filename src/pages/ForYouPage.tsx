import { useCallback, useState } from 'react'
import { RestartIcon } from '@solar-icons/react/linear/restart'
import type { PopularMediaItem } from '@/api/tmdb'
import FeedStatus from '@/components/FeedStatus/FeedStatus'
import ForYouFeed, { ForYouSkeleton } from '@/components/ForYouFeed/ForYouFeed'
import TasteSetup from '@/components/TasteSetup/TasteSetup'
import TrendingToday from '@/components/TrendingToday/TrendingToday'
import UndoToast from '@/components/UndoToast/UndoToast'
import { useLibrary } from '@/hooks/useLibrary'
import { useRecommendationFeed } from '@/hooks/useRecommendationFeed'
import { titleKey } from '@/lib/library'
import { countTasteTitles, recordImpression } from '@/recommendations'
import { REC } from '@/recommendations/config'
import './ForYouPage.css'

function ForYouPage() {
  const { isDismissed, dismissTitle, undoDismiss, library, ready } = useLibrary()

  // Too little history makes a feed that looks random, so a new account is asked to add a few
  // titles first. Nothing is requested for the feed until then.
  const tasteCount = countTasteTitles(library)
  const needsSetup = ready && tasteCount < REC.minTitlesForFeed
  const { items, status, done, cold, uid, loadMore, refresh } = useRecommendationFeed(
    ready && !needsSetup,
  )
  const [hidden, setHidden] = useState<PopularMediaItem | null>(null)

  const handleDismiss = (item: PopularMediaItem) => {
    dismissTitle(item)
    setHidden(item)
  }

  const handleUndo = () => {
    if (hidden) undoDismiss(hidden)
    setHidden(null)
  }

  const handleSeen = useCallback(
    (item: PopularMediaItem) => recordImpression(uid, titleKey(item)),
    [uid],
  )
  const closeToast = useCallback(() => setHidden(null), [])
  const retry = useCallback(() => void loadMore(), [loadMore])

  const isFirstLoad = !needsSetup && items.length === 0 && status !== 'error' && !done

  return (
    <section className="for-you" aria-label="Recommendations">
      <header className="for-you__header">
        <div className="for-you__heading">
          <h1 className="for-you__title">For You</h1>
          <p className="for-you__hint">
            {needsSetup
              ? 'Tell us what you like and this page turns into your own feed.'
              : cold
                ? 'Rate a few titles you have watched and this feed will start to match your taste.'
                : 'Picked from what you rate, watch and save. Hide what is not for you.'}
          </p>
        </div>

        {!needsSetup && (
          <button
            className="for-you__refresh"
            type="button"
            onClick={refresh}
            disabled={status === 'loading'}
            aria-label="Refresh recommendations"
            title="Refresh"
          >
            <RestartIcon size={18} aria-hidden="true" />
          </button>
        )}
      </header>

      {needsSetup && (
        <>
          <TasteSetup count={tasteCount} required={REC.minTitlesForFeed} />
          <TrendingToday />
        </>
      )}

      {isFirstLoad && (
        <>
          <span className="visually-hidden" role="status">
            Loading recommendations…
          </span>
          <ForYouSkeleton />
        </>
      )}

      {items.length === 0 && status === 'error' && (
        <FeedStatus message="Recommendations are unavailable right now." onRetry={retry} />
      )}

      {items.length === 0 && done && status !== 'error' && (
        <FeedStatus
          message="Nothing new to suggest right now. Rate more titles and check back."
          onRetry={refresh}
        />
      )}

      {items.length > 0 && (
        <>
          <ForYouFeed
            items={items}
            isDismissed={isDismissed}
            onDismiss={handleDismiss}
            onSeen={handleSeen}
            onNearEnd={retry}
            loadingMore={status === 'loading'}
            canLoadMore={!done && status !== 'error'}
          />

          {status === 'error' && (
            <FeedStatus message="Could not load more titles." onRetry={retry} />
          )}

          {done && (
            <p className="for-you__end">
              You have seen everything for now. Rate more titles to sharpen your feed.
            </p>
          )}
        </>
      )}

      {hidden && (
        <UndoToast
          message="Hidden. We will show less like this."
          onAction={handleUndo}
          onClose={closeToast}
        />
      )}
    </section>
  )
}

export default ForYouPage
