import { useLayoutEffect, useRef, type KeyboardEvent } from 'react'
import { categories, type CategoryId } from './categories'
import './CategoryTabs.css'

type CategoryTabsProps = {
  activeId: CategoryId
  onChange: (id: CategoryId) => void
  /** Called on hover/focus so the matching feed can start loading before the click. */
  onIntent?: (id: CategoryId) => void
}

function CategoryTabs({ activeId, onChange, onIntent }: CategoryTabsProps) {
  const tabsRef = useRef<HTMLDivElement>(null)
  const indicatorRef = useRef<HTMLSpanElement>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const hasPositioned = useRef(false)

  const activeIndex = categories.findIndex((category) => category.id === activeId)

  useLayoutEffect(() => {
    const container = tabsRef.current
    const indicator = indicatorRef.current

    const update = () => {
      const tab = tabRefs.current[activeIndex]
      if (!indicator || !tab) return

      indicator.style.width = `${tab.offsetWidth}px`
      indicator.style.transform = `translate3d(${tab.offsetLeft}px, 0, 0)`
    }

    // Place the indicator before the first paint and skip the entrance animation.
    if (!hasPositioned.current && indicator) {
      indicator.style.transition = 'none'
    }

    update()

    if (!hasPositioned.current && indicator) {
      void indicator.offsetWidth
      indicator.style.transition = ''
      hasPositioned.current = true
    }

    const observer = new ResizeObserver(update)
    if (container) observer.observe(container)

    window.addEventListener('resize', update)
    void document.fonts?.ready.then(update)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [activeIndex])

  const selectTab = (index: number) => {
    const tab = categories[index]
    onChange(tab.id)

    const element = tabRefs.current[index]
    element?.focus()
    element?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number

    switch (event.key) {
      case 'ArrowRight':
        nextIndex = (index + 1) % categories.length
        break
      case 'ArrowLeft':
        nextIndex = (index - 1 + categories.length) % categories.length
        break
      case 'Home':
        nextIndex = 0
        break
      case 'End':
        nextIndex = categories.length - 1
        break
      default:
        return
    }

    event.preventDefault()
    selectTab(nextIndex)
  }

  return (
    <div ref={tabsRef} className="category-tabs" role="tablist" aria-label="Categories">
      <span ref={indicatorRef} className="category-tabs__indicator" aria-hidden="true" />

      {categories.map((category, index) => {
        const isActive = category.id === activeId

        return (
          <button
            key={category.id}
            ref={(element) => {
              tabRefs.current[index] = element
            }}
            type="button"
            role="tab"
            id={`category-tab-${category.id}`}
            className="category-tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(category.id)}
            onPointerEnter={() => onIntent?.(category.id)}
            onFocus={() => onIntent?.(category.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {category.label}
          </button>
        )
      })}
    </div>
  )
}

export default CategoryTabs
