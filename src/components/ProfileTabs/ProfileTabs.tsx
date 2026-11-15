import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import './ProfileTabs.css'

export type ProfileTab = {
  id: string
  label: string
  /** `null` while the number is still loading. */
  count: number | null
}

type ProfileTabsProps = {
  tabs: ProfileTab[]
  activeId: string
  onChange: (id: string) => void
  /** Prefix that ties each tab to its panel (`${idPrefix}-tab-<id>` / `${idPrefix}-panel-<id>`). */
  idPrefix: string
}

type Indicator = { x: number; width: number }

function ProfileTabs({ tabs, activeId, onChange, idPrefix }: ProfileTabsProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [indicator, setIndicator] = useState<Indicator | null>(null)
  // The first placement must not slide in from the left edge, only later moves are animated.
  const [animated, setAnimated] = useState(false)
  const activeIndex = tabs.findIndex((tab) => tab.id === activeId)
  // A spring overshoots its target; at the first or last tab that would leave the row and be clipped.
  const isEdge = activeIndex === 0 || activeIndex === tabs.length - 1

  // The highlight is one element that glides to the active tab instead of each tab fading in.
  useLayoutEffect(() => {
    const active = tabRefs.current[activeIndex]
    if (!active) return

    const measure = () =>
      setIndicator((previous) =>
        previous && previous.x === active.offsetLeft && previous.width === active.offsetWidth
          ? previous
          : { x: active.offsetLeft, width: active.offsetWidth },
      )
    measure()

    // Counts load after the first paint and change the tab widths; so do window resizes.
    const observer = new ResizeObserver(measure)
    observer.observe(active)
    if (listRef.current) observer.observe(listRef.current)

    const frame = window.requestAnimationFrame(() => setAnimated(true))

    return () => {
      observer.disconnect()
      window.cancelAnimationFrame(frame)
    }
  }, [activeIndex, tabs])

  const select = (index: number) => {
    onChange(tabs[index].id)
    tabRefs.current[index]?.focus()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = tabs.length - 1
    const target =
      event.key === 'ArrowRight'
        ? (index + 1) % tabs.length
        : event.key === 'ArrowLeft'
          ? (index - 1 + tabs.length) % tabs.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null

    if (target === null) return
    event.preventDefault()
    select(target)
  }

  return (
    <div className="profile-tabs" role="tablist" aria-label="Your titles" ref={listRef}>
      {indicator && (
        <span
          className={`profile-tabs__indicator${animated ? ' profile-tabs__indicator--animated' : ''}${
            isEdge ? ' profile-tabs__indicator--edge' : ''
          }`}
          style={
            {
              '--indicator-x': `${indicator.x}px`,
              '--indicator-width': `${indicator.width}px`,
            } as CSSProperties
          }
          aria-hidden="true"
        />
      )}
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeId

        return (
          <button
            key={tab.id}
            ref={(element) => {
              tabRefs.current[index] = element
            }}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${tab.id}`}
            aria-controls={`${idPrefix}-panel-${tab.id}`}
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            className="profile-tab"
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {tab.label}
            <span className="profile-tab__count">{tab.count ?? '–'}</span>
          </button>
        )
      })}
    </div>
  )
}

export default ProfileTabs