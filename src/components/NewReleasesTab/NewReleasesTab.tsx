import MediaRail from '@/components/MediaRail/MediaRail'
import { useNewReleasesMedia } from '@/hooks/useNewReleasesMedia'
// Same layout as the Popular tab, so its styles are shared.
import '@/components/PopularTab/PopularTab.css'

const label = `New ${new Date().getFullYear()}`

function NewReleasesTab() {
  const { media, error, isLoading } = useNewReleasesMedia()

  if (error || !media) {
    return (
      <section className="popular-tab" aria-label={label}>
        <p className="popular-tab__status">
          {isLoading ? 'Loading new releases…' : 'New releases are unavailable right now.'}
        </p>
      </section>
    )
  }

  return (
    <section className="popular-tab" aria-label={label}>
      {media.movies.length > 0 && <MediaRail title="Movies" items={media.movies} />}
      {media.series.length > 0 && <MediaRail title="Series" items={media.series} />}
      {media.animation.length > 0 && <MediaRail title="Animation" items={media.animation} />}
    </section>
  )
}

export default NewReleasesTab