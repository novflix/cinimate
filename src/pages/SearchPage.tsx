import { useSearchParams } from 'react-router-dom'
import SearchBox from '@/components/SearchBox/SearchBox'
import SearchResults from '@/components/SearchResults/SearchResults'
import TrendingToday from '@/components/TrendingToday/TrendingToday'
import { useSearch } from '@/hooks/useSearch'
import './SearchPage.css'

function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''
  const { state, retry } = useSearch(query)
  const trimmed = query.trim()

  // The query lives in the URL, so a title opened from the results can be closed back into them.
  const handleQueryChange = (value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set('q', value)
    else next.delete('q')
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="search-page">
      <h1 className="visually-hidden">Search</h1>

      <SearchBox value={query} onChange={handleQueryChange} />

      {trimmed.length === 0 ? (
        <TrendingToday />
      ) : (
        <SearchResults
          query={trimmed}
          results={state.results}
          status={state.status}
          isRefining={state.isRefining}
          showSkeleton={state.showSkeleton}
          error={state.error}
          onRetry={retry}
        />
      )}
    </div>
  )
}

export default SearchPage
