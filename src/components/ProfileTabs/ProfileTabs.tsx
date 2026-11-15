import { useRef, type KeyboardEvent } from 'react'
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

function ProfileTabs({ tabs, activeId, onChange, idPrefix }: ProfileTabsProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

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
    <div className="profile-tabs" role="tablist" aria-label="Your titles">
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
