import { useEffect, useState } from 'react'
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
  const [activeCategory, setActiveCategory] = useState<CategoryId>(categories[0].id)

  // Warm the other tabs in the background once the page is idle.
  useEffect(() => {
    scheduleFeedPrefetch()
  }, [])

  const handleIntent = (id: CategoryId) => {
    if (isFeedId(id)) prefetchFeed(id)
  }

  return (
    <>
      <HeroBanner />
      <CategoryTabs
        activeId={activeCategory}
        onChange={setActiveCategory}
        onIntent={handleIntent}
      />

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
