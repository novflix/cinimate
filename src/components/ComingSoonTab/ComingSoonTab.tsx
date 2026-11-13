import MediaGrid from '@/components/MediaGrid/MediaGrid'
import { useComingSoonMedia } from '@/hooks/useComingSoonMedia'
// Same page layout as the Popular tab, so its styles are shared.
import '@/components/PopularTab/PopularTab.css'

function ComingSoonTab() {
  const { media, error, isLoading } = useComingSoonMedia()

  if (error || !media) {
    return (
      <section className="popular-tab" aria-label="Coming soon">
        <p className="popular-tab__status">
          {isLoading ? 'Loading upcoming titles…' : 'Upcoming titles are unavailable right now.'}
        </p>
      </section>
    )
  }

  return (
    <section className="popular-tab" aria-label="Coming soon">
      {media.length === 0 ? (
        <p className="popular-tab__status">No upcoming titles found.</p>
      ) : (
        <MediaGrid label="Coming soon" items={media} variant="upcoming" />
      )}
    </section>
  )
}

export default ComingSoonTab