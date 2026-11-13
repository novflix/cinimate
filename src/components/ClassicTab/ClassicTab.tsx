import MediaRail from '@/components/MediaRail/MediaRail'
import { useClassicMedia } from '@/hooks/useClassicMedia'
import '@/components/PopularTab/PopularTab.css'

function ClassicTab() {
  const { media, error, isLoading } = useClassicMedia()

  if (error || !media) {
    return (
      <section className="popular-tab" aria-label="Classic">
        <p className="popular-tab__status">
          {isLoading ? 'Loading classic titles…' : 'Classic titles are unavailable right now.'}
        </p>
      </section>
    )
  }

  return (
    <section className="popular-tab" aria-label="Classic">
      {media.movies.length > 0 && <MediaRail title="Movies" items={media.movies} />}
      {media.series.length > 0 && <MediaRail title="Series" items={media.series} />}
      {media.animation.length > 0 && <MediaRail title="Animation" items={media.animation} />}
    </section>
  )
}

export default ClassicTab