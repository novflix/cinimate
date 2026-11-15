import type { SearchResult } from '@/api/search'
import type { PopularMediaItem } from '@/api/tmdb'
import CardGrid, { CardGridSkeleton } from '@/components/CardGrid/CardGrid'
import type { SearchStatus } from '@/hooks/useSearch'
import './SearchResults.css'

type SearchResultsProps = {
  query: string
  results: SearchResult[]
  status: SearchStatus
  isRefining: boolean
  showSkeleton: boolean
  error: unknown
  onRetry: () => void
}

/** Search rows reuse the catalogue card, so results look like the rest of the app. */
function toCard(result: SearchResult): PopularMediaItem {
  return {
    id: result.id,
    kind: result.kind,
    title: result.title,
    year: result.year,
    rating: result.rating,
    backdrop: result.backdrop,
    poster: result.poster,
    popularity: result.popularity,
    releaseDate: result.releaseDate,
  }
}

function SearchResults({
  query,
  results,
  status,
  isRefining,
  showSkeleton,
  error,
  onRetry,
}: SearchResultsProps) {
  const busy = status === 'loading' || isRefining

  return (
    <section className="search-results" aria-label={`Search results for ${query}`} aria-busy={busy}>
      <span className="visually-hidden" role="status">
        {status === 'loading'
          ? 'Searching…'
          : results.length > 0
            ? `${results.length} ${results.length === 1 ? 'result' : 'results'} found`
            : ''}
      </span>

      {status === 'error' && (
        <div className="search-results__error" role="status">
          <p>Search is unavailable right now.</p>
          <button type="button" className="search-results__retry" onClick={onRetry}>
            Try again
          </button>
        </div>
      )}

      {status === 'loading' && showSkeleton && <CardGridSkeleton rows={2} />}

      {status === 'ready' && results.length === 0 && (
        <p className="search-results__empty">
          No results for <strong>“{query}”</strong>. Check the spelling or try another search.
        </p>
      )}

      {results.length > 0 && (
        <>
          <div className="search-results__summary">
            <span>
              {results.length} {results.length === 1 ? 'result' : 'results'}
            </span>
            {isRefining && <span className="search-results__refining">Refining…</span>}
          </div>

          <CardGrid
            label={`Search results for ${query}`}
            items={results.map(toCard)}
            priority
          />
        </>
      )}

      {status === 'ready' && error !== null && error !== undefined && (
        <p className="search-results__note">Some sources could not be reached.</p>
      )}
    </section>
  )
}

export default SearchResults
