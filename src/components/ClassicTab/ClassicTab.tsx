import FeedStatus from '@/components/FeedStatus/FeedStatus'
import MediaRail from '@/components/MediaRail/MediaRail'
import { MediaRailSkeleton } from '@/components/Skeleton/Skeleton'
import { useClassicMedia } from '@/hooks/useClassicMedia'
import '@/components/PopularTab/PopularTab.css'

function ClassicTab() {
  const { media, error, isLoading, reload } = useClassicMedia()

  if (isLoading) {
    return (
      <section className="popular-tab" aria-label="Classic" aria-busy="true">
        <span className="visually-hidden" role="status">
          Loading classic titles…
        </span>
        <MediaRailSkeleton />
        <MediaRailSkeleton />
        <MediaRailSkeleton />
      </section>
    )
  }

  if (error || !media) {
    return (
      <section className="popular-tab" aria-label="Classic">
        <FeedStatus message="Classic titles are unavailable right now." onRetry={reload} />
      </section>
    )
  }

  return (
    <section className="popular-tab" aria-label="Classic">
      <div className="popular-tab__content">
        <MediaRail title="Movies" items={media.movies} priority />
        {media.series.length > 0 && <MediaRail title="Series" items={media.series} />}
        {media.animation.length > 0 && <MediaRail title="Animation" items={media.animation} />}
      </div>
    </section>
  )
}

export default ClassicTab
