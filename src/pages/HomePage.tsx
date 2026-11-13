import { useState } from 'react'
import CategoryTabs from '@/components/CategoryTabs/CategoryTabs'
import { categories, type CategoryId } from '@/components/CategoryTabs/categories'
import HeroBanner from '@/components/HeroBanner/HeroBanner'
import NowPlayingTab from '@/components/NowPlayingTab/NowPlayingTab'
import PopularTab from '@/components/PopularTab/PopularTab'

function HomePage() {
  const [activeCategory, setActiveCategory] = useState<CategoryId>(categories[0].id)

  return (
    <>
      <HeroBanner />
      <CategoryTabs activeId={activeCategory} onChange={setActiveCategory} />
      {activeCategory === 'popular' && <PopularTab />}
      {activeCategory === 'now-playing' && <NowPlayingTab />}
    </>
  )
}

export default HomePage