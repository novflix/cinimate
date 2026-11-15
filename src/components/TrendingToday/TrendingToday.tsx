import { useId } from 'react'
import CardGrid, { CardGridSkeleton } from '@/components/CardGrid/CardGrid'
import FeedStatus from '@/components/FeedStatus/FeedStatus'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useTrendingToday } from '@/hooks/useTrendingToday'
import './TrendingToday.css'

function TrendingToday() {
  const { media, error, isLoading, reload } = useTrendingToday()
  const titleId = useId()
  // Phones show a compact 3×3 block; the wider layout keeps two rows.
  const rows = useMediaQuery('(max-width: 768px)') ? 3 : 2

  return (
    <section className="trending-today" aria-labelledby={titleId} aria-busy={isLoading}>
      <h2 className="trending-today__title" id={titleId}>
        Trending Today
      </h2>

      {isLoading ? (
        <CardGridSkeleton rows={rows} />
      ) : error || !media ? (
        <FeedStatus message="Trending titles are unavailable right now." onRetry={reload} />
      ) : media.length === 0 ? (
        <p className="trending-today__empty">Nothing is trending right now.</p>
      ) : (
        <CardGrid label="Trending today" items={media} maxRows={rows} priority />
      )}
    </section>
  )
}

export default TrendingToday
