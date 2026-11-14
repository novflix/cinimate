import FeedStatus from '@/components/FeedStatus/FeedStatus'
import MediaRail from '@/components/MediaRail/MediaRail'
import { MediaRailSkeleton } from '@/components/Skeleton/Skeleton'
import { usePopularMedia } from '@/hooks/usePopularMedia'
import './PopularTab.css'

function PopularTab() {
  const { media, error, isLoading, reload } = usePopularMedia()

  if (isLoading) {
    return (
      <section className="popular-tab" aria-label="Popular" aria-busy="true">
        <span className="visually-hidden" role="status">
          Loading popular titles…
        </span>
        <MediaRailSkeleton />
        <MediaRailSkeleton />
        <MediaRailSkeleton />
      </section>
    )
  }

  if (error || !media) {
    return (
      <section className="popular-tab" aria-label="Popular">
        <FeedStatus message="Popular titles are unavailable right now." onRetry={reload} />
      </section>
    )
  }

  return (
    <section className="popular-tab" aria-label="Popular">
      <div className="popular-tab__content">
        <MediaRail title="Movies" items={media.movies} priority />
        <MediaRail title="Series" items={media.series} />
        <MediaRail title="Animation" items={media.animation} />
      </div>
    </section>
  )
}

export default PopularTab
