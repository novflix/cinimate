import { useEffect, useLayoutEffect, useRef } from 'react'
import { CompassIcon } from '@solar-icons/react/bold/compass'
import { HomeIcon } from '@solar-icons/react/bold/home'
import { SettingsIcon } from '@solar-icons/react/bold/settings'
import { UserIcon } from '@solar-icons/react/bold/user'
import { MagnifierIcon } from '@solar-icons/react/linear/magnifier'
import { NavLink, useLocation } from 'react-router-dom'
import type { LiquidGlass as LiquidGlassInstance } from '@ybouane/liquidglass'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import './MobileNav.css'

const items = [
  { label: 'Home', href: '/', Icon: HomeIcon },
  { label: 'Recommendations', href: '/recommendations', Icon: CompassIcon },
  { label: 'Profile', href: '/profile', Icon: UserIcon },
  { label: 'Settings', href: '/settings', Icon: SettingsIcon },
] as const

const pillGlassConfig = JSON.stringify({
  cornerRadius: 30,
  zRadius: 20,
  blurAmount: 0.62,
  refraction: 0.42,
  chromAberration: 0.018,
  edgeHighlight: 0.2,
  specular: 0,
  fresnel: 0.7,
  saturation: 0.15,
  shadowOpacity: 0.26,
  shadowSpread: 12,
  shadowOffsetY: 4,
})

const searchGlassConfig = JSON.stringify({
  cornerRadius: 30,
  zRadius: 20,
  blurAmount: 0.62,
  refraction: 0.42,
  chromAberration: 0.018,
  edgeHighlight: 0.2,
  specular: 0,
  fresnel: 0.7,
  saturation: 0.15,
  shadowOpacity: 0.26,
  shadowSpread: 12,
  shadowOffsetY: 4,
})

const indicatorGlassConfig = JSON.stringify({
  cornerRadius: 22,
  zRadius: 10,
  blurAmount: 0.45,
  refraction: 0.3,
  chromAberration: 0.01,
  edgeHighlight: 0.14,
  specular: 0,
  fresnel: 0.55,
  opacity: 0.8,
  saturation: 0.1,
  shadowOpacity: 0.06,
  shadowSpread: 4,
  shadowOffsetY: 1,
})

const INDICATOR_INSET = 6

type MobileNavProps = {
  glassRoot: React.RefObject<HTMLDivElement | null>
}

function MobileNav({ glassRoot }: MobileNavProps) {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const { pathname } = useLocation()

  const pillRef = useRef<HTMLDivElement>(null)
  const searchBgRef = useRef<HTMLDivElement>(null)
  const indicatorRef = useRef<HTMLDivElement>(null)
  const tabsRef = useRef<HTMLElement>(null)
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([])
  const instanceRef = useRef<LiquidGlassInstance | null>(null)

  const isSearch = pathname.startsWith('/search')
  const activeIndex = items.findIndex((item) =>
    item.href === '/' ? pathname === '/' : pathname.startsWith(item.href),
  )

  useLayoutEffect(() => {
    if (!isMobile) return

    const updateIndicator = () => {
      const indicator = indicatorRef.current
      const target = isSearch ? searchBgRef.current : tabRefs.current[activeIndex]
      if (!indicator) return

      indicator.style.opacity = target ? '1' : '0'
      if (!target) return

      const targetRect = target.getBoundingClientRect()

      indicator.style.width = `${targetRect.width - INDICATOR_INSET * 2}px`
      indicator.style.height = `${targetRect.height - INDICATOR_INSET * 2}px`
      indicator.style.transform = `translate3d(${targetRect.left + INDICATOR_INSET}px, ${
        targetRect.top + INDICATOR_INSET
      }px, 0)`

      instanceRef.current?.markChanged()
    }

    updateIndicator()

    const observer = new ResizeObserver(updateIndicator)
    if (pillRef.current) observer.observe(pillRef.current)
    if (tabsRef.current) observer.observe(tabsRef.current)
    window.addEventListener('resize', updateIndicator)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateIndicator)
    }
  }, [isMobile, activeIndex, isSearch])

  useEffect(() => {
    if (!isMobile) return

    const root = glassRoot.current
    const glassElements = [pillRef.current, searchBgRef.current, indicatorRef.current].filter(
      (element) => element !== null,
    )

    if (!root || glassElements.length !== 3) return

    let cancelled = false
    let instance: LiquidGlassInstance | null = null

    const setup = async () => {
      try {
        const { LiquidGlass } = await import('@ybouane/liquidglass')
        if (cancelled) return

        instance = await LiquidGlass.init({ root, glassElements })
        if (cancelled) {
          instance.destroy()
          return
        }

        instanceRef.current = instance

        // The library disables text selection on the whole root; keep the page selectable.
        root.style.removeProperty('user-select')
        root.style.removeProperty('-webkit-user-select')
      } catch (error) {
        console.warn('LiquidGlass failed to initialise', error)
      }
    }

    void setup()

    return () => {
      cancelled = true
      instanceRef.current = null
      instance?.destroy()
    }
  }, [isMobile, glassRoot])

  if (!isMobile) return null

  return (
    <>
      <div className="mobile-nav__glow" aria-hidden="true" />

      <div
        ref={pillRef}
        className="mobile-nav__pill"
        data-config={pillGlassConfig}
        aria-hidden="true"
      />

      <div
        ref={searchBgRef}
        className="mobile-nav__search-bg"
        data-config={searchGlassConfig}
        aria-hidden="true"
      />

      <NavLink className="mobile-nav__search" to="/search" aria-label="Search">
        <MagnifierIcon size={24} />
      </NavLink>

      <div
        ref={indicatorRef}
        className="mobile-nav__indicator"
        data-config={indicatorGlassConfig}
        aria-hidden="true"
      />

      <nav ref={tabsRef} className="mobile-nav__tabs" aria-label="Main">
        {items.map(({ label, href, Icon }, index) => (
          <NavLink
            key={href}
            ref={(element) => {
              tabRefs.current[index] = element
            }}
            className="mobile-nav__tab"
            to={href}
            end={href === '/'}
            aria-label={label}
          >
            <Icon size={24} />
          </NavLink>
        ))}
      </nav>
    </>
  )
}

export default MobileNav
