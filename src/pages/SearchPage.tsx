import { useState } from 'react'
import SearchBox from '@/components/SearchBox/SearchBox'
import SearchResults from '@/components/SearchResults/SearchResults'
import TrendingToday from '@/components/TrendingToday/TrendingToday'
import { useSearch } from '@/hooks/useSearch'
import './SearchPage.css'

function SearchPage() {
  const [query, setQuery] = useState('')
  const { state, retry } = useSearch(query)
  const trimmed = query.trim()

  return (
    <div className="search-page">
      <h1 className="visually-hidden">Search</h1>

      <SearchBox value={query} onChange={setQuery} />

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
