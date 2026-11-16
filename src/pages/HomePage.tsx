import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { isFeedId, prefetchFeed, scheduleFeedPrefetch } from '@/api/preload'
import CategoryTabs from '@/components/CategoryTabs/CategoryTabs'
import { categories, type CategoryId } from '@/components/CategoryTabs/categories'
import ClassicTab from '@/components/ClassicTab/ClassicTab'
import ComingSoonTab from '@/components/ComingSoonTab/ComingSoonTab'
import HeroBanner from '@/components/HeroBanner/HeroBanner'
import NewReleasesTab from '@/components/NewReleasesTab/NewReleasesTab'
import NowPlayingTab from '@/components/NowPlayingTab/NowPlayingTab'
import PopularTab from '@/components/PopularTab/PopularTab'
import './HomePage.css'

function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get('tab')
  const activeCategory = categories.some((category) => category.id === requested)
    ? (requested as CategoryId)
    : categories[0].id

  // Warm the other tabs in the background once the page is idle.
  useEffect(() => {
    scheduleFeedPrefetch()
  }, [])

  const handleIntent = (id: CategoryId) => {
    if (isFeedId(id)) prefetchFeed(id)
  }

  // The tab lives in the URL, so going to a title and coming back lands on the same one.
  const handleChange = (id: CategoryId) => {
    const next = new URLSearchParams(searchParams)
    if (id === categories[0].id) next.delete('tab')
    else next.set('tab', id)
    setSearchParams(next, { replace: true })
  }

  return (
    <>
      <HeroBanner />
      <CategoryTabs activeId={activeCategory} onChange={handleChange} onIntent={handleIntent} />

      <div className="home-page__panel" key={activeCategory}>
        {activeCategory === 'popular' && <PopularTab />}
        {activeCategory === 'now-playing' && <NowPlayingTab />}
        {activeCategory === 'coming-soon' && <ComingSoonTab />}
        {activeCategory === 'classic' && <ClassicTab />}
        {activeCategory === 'new-releases' && <NewReleasesTab />}
      </div>
    </>
  )
}

export default HomePage
