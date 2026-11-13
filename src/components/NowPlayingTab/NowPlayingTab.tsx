import MediaRail from '@/components/MediaRail/MediaRail'
import { useNowPlayingMedia } from '@/hooks/useNowPlayingMedia'
// Same layout as the Popular tab, so its styles are shared.
import '@/components/PopularTab/PopularTab.css'

function NowPlayingTab() {
  const { media, error, isLoading } = useNowPlayingMedia()

  if (error || !media) {
    return (
      <section className="popular-tab" aria-label="Now in theaters">
        <p className="popular-tab__status">
          {isLoading
            ? 'Loading titles in theaters…'
            : 'Titles in theaters are unavailable right now.'}
        </p>
      </section>
    )
  }

  const isEmpty = media.movies.length === 0 && media.animation.length === 0

  return (
    <section className="popular-tab" aria-label="Now in theaters">
      {isEmpty && (
        <p className="popular-tab__status">No titles are in theaters right now.</p>
      )}
      {media.movies.length > 0 && <MediaRail title="Movies" items={media.movies} />}
      {media.animation.length > 0 && (
        <MediaRail title="Animation" items={media.animation} />
      )}
    </section>
  )
}

export default NowPlayingTab