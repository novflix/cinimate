import FeedStatus from '@/components/FeedStatus/FeedStatus'
import MediaRail from '@/components/MediaRail/MediaRail'
import { MediaRailSkeleton } from '@/components/Skeleton/Skeleton'
import { useNowPlayingMedia } from '@/hooks/useNowPlayingMedia'
// Same layout as the Popular tab, so its styles are shared.
import '@/components/PopularTab/PopularTab.css'

function NowPlayingTab() {
  const { media, error, isLoading, reload } = useNowPlayingMedia()

  if (isLoading) {
    return (
      <section className="popular-tab" aria-label="Now in theaters" aria-busy="true">
        <span className="visually-hidden" role="status">
          Loading titles in theaters…
        </span>
        <MediaRailSkeleton />
        <MediaRailSkeleton />
      </section>
    )
  }

  if (error || !media) {
    return (
      <section className="popular-tab" aria-label="Now in theaters">
        <FeedStatus
          message="Titles in theaters are unavailable right now."
          onRetry={reload}
        />
      </section>
    )
  }

  const isEmpty = media.movies.length === 0 && media.animation.length === 0

  return (
    <section className="popular-tab" aria-label="Now in theaters">
      {isEmpty ? (
        <p className="popular-tab__status">No titles are in theaters right now.</p>
      ) : (
        <div className="popular-tab__content">
          {media.movies.length > 0 && <MediaRail title="Movies" items={media.movies} priority />}
          {media.animation.length > 0 && (
            <MediaRail title="Animation" items={media.animation} />
          )}
        </div>
      )}
    </section>
  )
}

export default NowPlayingTab
