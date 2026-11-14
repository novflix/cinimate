import FeedStatus from '@/components/FeedStatus/FeedStatus'
import MediaRail from '@/components/MediaRail/MediaRail'
import { MediaRailSkeleton } from '@/components/Skeleton/Skeleton'
import { useNewReleasesMedia } from '@/hooks/useNewReleasesMedia'
// Same layout as the Popular tab, so its styles are shared.
import '@/components/PopularTab/PopularTab.css'

const label = `New ${new Date().getFullYear()}`

function NewReleasesTab() {
  const { media, error, isLoading, reload } = useNewReleasesMedia()

  if (isLoading) {
    return (
      <section className="popular-tab" aria-label={label} aria-busy="true">
        <span className="visually-hidden" role="status">
          Loading new releases…
        </span>
        <MediaRailSkeleton />
        <MediaRailSkeleton />
        <MediaRailSkeleton />
      </section>
    )
  }

  if (error || !media) {
    return (
      <section className="popular-tab" aria-label={label}>
        <FeedStatus message="New releases are unavailable right now." onRetry={reload} />
      </section>
    )
  }

  return (
    <section className="popular-tab" aria-label={label}>
      <div className="popular-tab__content">
        <MediaRail title="Movies" items={media.movies} priority />
        {media.series.length > 0 && <MediaRail title="Series" items={media.series} />}
        {media.animation.length > 0 && <MediaRail title="Animation" items={media.animation} />}
      </div>
    </section>
  )
}

export default NewReleasesTab
