import MediaRail from '@/components/MediaRail/MediaRail'
import { usePopularMedia } from '@/hooks/usePopularMedia'
import './PopularTab.css'

function PopularTab() {
  const { media, error, isLoading } = usePopularMedia()

  if (error || !media) {
    return (
      <section className="popular-tab" aria-label="Popular">
        <p className="popular-tab__status">
          {isLoading ? 'Loading popular titles…' : 'Popular titles are unavailable right now.'}
        </p>
      </section>
    )
  }

  return (
    <section className="popular-tab" aria-label="Popular">
      <MediaRail title="Movies" items={media.movies} />
      <MediaRail title="Series" items={media.series} />
      <MediaRail title="Animation" items={media.animation} />
    </section>
  )
}

export default PopularTab
