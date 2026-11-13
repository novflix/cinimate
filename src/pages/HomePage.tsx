import { useState } from 'react'
import CategoryTabs from '@/components/CategoryTabs/CategoryTabs'
import { categories, type CategoryId } from '@/components/CategoryTabs/categories'
import HeroBanner from '@/components/HeroBanner/HeroBanner'

function HomePage() {
  const [activeCategory, setActiveCategory] = useState<CategoryId>(categories[0].id)

  return (
    <>
      <HeroBanner />
      <CategoryTabs activeId={activeCategory} onChange={setActiveCategory} />
    </>
  )
}

export default HomePage
