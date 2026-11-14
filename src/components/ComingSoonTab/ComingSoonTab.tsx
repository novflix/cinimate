import FeedStatus from '@/components/FeedStatus/FeedStatus'
import MediaGrid from '@/components/MediaGrid/MediaGrid'
import { MediaGridSkeleton } from '@/components/Skeleton/Skeleton'
import { useComingSoonMedia } from '@/hooks/useComingSoonMedia'
// Same page layout as the Popular tab, so its styles are shared.
import '@/components/PopularTab/PopularTab.css'

function ComingSoonTab() {
  const { media, error, isLoading, reload } = useComingSoonMedia()

  if (isLoading) {
    return (
      <section className="popular-tab" aria-label="Coming soon" aria-busy="true">
        <span className="visually-hidden" role="status">
          Loading upcoming titles…
        </span>
        <MediaGridSkeleton />
      </section>
    )
  }

  if (error || !media) {
    return (
      <section className="popular-tab" aria-label="Coming soon">
        <FeedStatus message="Upcoming titles are unavailable right now." onRetry={reload} />
      </section>
    )
  }

  return (
    <section className="popular-tab" aria-label="Coming soon">
      {media.length === 0 ? (
        <p className="popular-tab__status">No upcoming titles found.</p>
      ) : (
        <div className="popular-tab__content">
          <MediaGrid label="Coming soon" items={media} variant="upcoming" />
        </div>
      )}
    </section>
  )
}

export default ComingSoonTab
