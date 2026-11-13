import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CompassIcon } from '@solar-icons/react/bold/compass'
import { HomeIcon } from '@solar-icons/react/bold/home'
import { SettingsIcon } from '@solar-icons/react/bold/settings'
import { UserIcon } from '@solar-icons/react/bold/user'
import { MagnifierIcon } from '@solar-icons/react/linear/magnifier'
import { NavLink, useLocation } from 'react-router-dom'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import type { LgNavbarElement } from '@/vendor/components.js'
import type { LiquidGlassController, LiquidGlassOptions } from '@/vendor/liquid-glass'
import './MobileNav.css'

type CreateSpring = typeof import('@/vendor/components.js').createSpring
type TravelRect = { left: number; width: number }

const items = [
  { label: 'Home', href: '/', Icon: HomeIcon },
  { label: 'Recommendations', href: '/recommendations', Icon: CompassIcon },
  { label: 'Profile', href: '/profile', Icon: UserIcon },
  { label: 'Settings', href: '/settings', Icon: SettingsIcon },
] as const

// The search circle floats over the page with no marked backdrop, so the engine refracts the live
// page behind it in Chromium and falls back to frosted blur in WebKit/Gecko.
const searchGlass: LiquidGlassOptions = {
  mode: 'backdrop',
  fit: true,
  radius: 30,
  refraction: 12,
  bezel: 0.55,
  curvature: 3,
  ior: 1.45,
  chroma: 0.04,
  blur: 10,
  specular: 0.4,
  specularWidth: 1.5,
  lightAngle: -90,
  fallback: 'blur(20px) saturate(160%)',
}

// The selected-search lens copies the navbar indicator optics exactly, so both highlights are the
// same piece of glass — only the outline differs (circle vs. capsule).
const searchLensGlass: LiquidGlassOptions = {
  fit: true,
  clip: true,
  radius: 26,
  refraction: 8,
  bezel: 0.6,
  curvature: 3,
  chroma: 0,
  specular: 0.7,
  specularWidth: 1.5,
}

function MobileNav() {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const { pathname } = useLocation()

  const isSearch = pathname.startsWith('/search')
  const activeIndex = items.findIndex((item) =>
    item.href === '/' ? pathname === '/' : pathname.startsWith(item.href),
  )

  const navRef = useRef<LgNavbarElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const searchLensRef = useRef<HTMLSpanElement>(null)
  const travelerRef = useRef<HTMLSpanElement>(null)
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([])
  const createSpringRef = useRef<CreateSpring | null>(null)
  const travelSpringRef = useRef<ReturnType<CreateSpring> | null>(null)
  const travelerRectRef = useRef<TravelRect>({ left: 0, width: 0 })
  const routeRef = useRef({ pathname, isSearch, index: activeIndex })
  const [navReady, setNavReady] = useState(false)

  // Upgrading <lg-navbar> adds a refracted copy of the icons and the sliding lens. The module is
  // loaded on the client only, once, and the element upgrades in place on subsequent mounts.
  useEffect(() => {
    if (!isMobile) return

    let disposed = false
    const search = searchRef.current
    const searchLens = searchLensRef.current
    let glass: LiquidGlassController | null = null
    let lensGlass: LiquidGlassController | null = null

    void import('@/vendor/components.js').then(({ createGlass, createSpring }) => {
      if (disposed) return
      if (search) glass = createGlass(search, searchGlass)
      if (searchLens) lensGlass = createGlass(searchLens, searchLensGlass)
      createSpringRef.current = createSpring
      setNavReady(true)
    })

    return () => {
      disposed = true
      glass?.destroy()
      glass = null
      lensGlass?.destroy()
      lensGlass = null
      createSpringRef.current = null
      travelSpringRef.current?.stop()
      travelSpringRef.current = null
    }
  }, [isMobile])

  useLayoutEffect(() => {
    if (!isMobile || !navReady) return

    const nav = navRef.current
    if (!nav || activeIndex < 0) return

    nav.setCurrent(activeIndex)
  }, [activeIndex, isMobile, navReady])

  // The bar's lens is clipped inside its pill, so it cannot reach the floating search circle.
  // When the selection crosses that gap, an overlay carries the same fill over as one spring —
  // the highlight glides out of the bar, through the glass and into the circle (and back).
  useLayoutEffect(() => {
    const prev = routeRef.current
    routeRef.current = { pathname, isSearch, index: activeIndex }

    // Tab → tab is handled by the navbar's own lens; only search transitions need the overlay.
    if (!isMobile || !navReady || prev.pathname === pathname || prev.isSearch === isSearch) return

    const root = rootRef.current
    const nav = navRef.current
    const traveler = travelerRef.current
    const searchBg = searchRef.current
    const createSpring = createSpringRef.current
    if (!root || !nav || !traveler || !searchBg || !createSpring) return

    const rootLeft = root.getBoundingClientRect().left

    const searchRect = (): TravelRect => {
      const rect = searchBg.getBoundingClientRect()
      // The circle's lens sits 4px inside the glass body, exactly like the bar's links.
      return { left: rect.left - rootLeft + 4, width: rect.width - 8 }
    }

    const tabRect = (index: number): TravelRect | null => {
      const link = linkRefs.current[index]
      if (!link) return null
      const rect = link.getBoundingClientRect()
      return { left: rect.left - rootLeft, width: rect.width }
    }

    const target = isSearch ? searchRect() : activeIndex >= 0 ? tabRect(activeIndex) : null
    if (!target || target.width < 1 || target.left < 0) return

    // A second tap mid-flight: carry on from where the highlight currently is.
    const inFlight = travelSpringRef.current !== null
    const from = inFlight
      ? { ...travelerRectRef.current }
      : isSearch
        ? prev.index >= 0
          ? tabRect(prev.index)
          : null
        : searchRect()
    if (!from || from.width < 1 || from.left < 0) return

    if (from.left === target.left && from.width === target.width) {
      return // no meaningful travel to perform
    }

    travelSpringRef.current?.stop()
    root.classList.add('is-traveling')
    if (!isSearch) root.classList.add('is-traveling-to-tab')
    traveler.classList.add('is-active')

    const dx = target.left - from.left
    const dw = target.width - from.width

    const placeTraveler = (t: number, velocity: number) => {
      const left = from.left + dx * t
      const width = from.width + dw * t
      // Same velocity-driven stretch as the navbar lens, so the flight feels like the same piece.
      const stretch = Math.min(14, Math.abs(velocity * dx) * 0.025)
      traveler.style.width = `${width + stretch}px`
      traveler.style.transform = `translate3d(${left - stretch / 2}px, 0, 0)`
      travelerRectRef.current = { left: left - stretch / 2, width: width + stretch }
    }

    placeTraveler(0, 0)

    const finish = () => {
      travelSpringRef.current = null
      traveler.classList.remove('is-active')
      traveler.style.width = ''
      traveler.style.transform = ''

      if (isSearch) {
        searchBg.classList.add('mobile-nav__search-bg--settled')
      } else {
        nav.setCurrent(activeIndex)
        nav.moveTo(activeIndex, true)
        nav.classList.add('mobile-nav__navbar--settled')
      }

      // Removing the travelling classes after the settled ones keeps the destination from fading
      // in: both are painted at the same rect in the same frame, so the hand-off is invisible.
      root.classList.remove('is-traveling', 'is-traveling-to-tab')

      requestAnimationFrame(() => {
        searchBg.classList.remove('mobile-nav__search-bg--settled')
        nav.classList.remove('mobile-nav__navbar--settled')
      })
    }

    const spring = createSpring(
      0,
      (t, velocity) => {
        placeTraveler(t, velocity)
        if (t === 1 && velocity === 0) finish()
      },
      { stiffness: 380, damping: 30 },
    )

    travelSpringRef.current = spring
    spring.set(1)
  }, [activeIndex, isMobile, isSearch, navReady, pathname])

  if (!isMobile) return null

  return (
    <div ref={rootRef} className="mobile-nav">
      <div className="mobile-nav__scrim" aria-hidden="true" />

      <div className="mobile-nav__glow" aria-hidden="true" />

      <div
        ref={searchRef}
        className={`mobile-nav__search-bg${isSearch ? ' mobile-nav__search-bg--active' : ''}`}
        aria-hidden="true"
      >
        <span className="mobile-nav__search-lens-shadow" />
        <span ref={searchLensRef} className="mobile-nav__search-lens" />
      </div>

      <span ref={travelerRef} className="mobile-nav__traveler" aria-hidden="true" />

      <NavLink className="mobile-nav__search" to="/search" aria-label="Search">
        <MagnifierIcon size={24} />
      </NavLink>

      <lg-navbar
        ref={navRef}
        className={`mobile-nav__navbar${isSearch ? ' mobile-nav__navbar--idle' : ''}`}
        data-active={activeIndex >= 0 ? activeIndex : undefined}
        aria-label="Main"
        refraction="20"
        bezel="0.75"
        curvature="3"
        chroma="0.05"
        blur="10"
        specular="0.4"
        specular-width="1.5"
        light-angle="-90"
      >
        {items.map(({ label, href, Icon }, index) => (
          <NavLink
            key={href}
            ref={(element) => {
              linkRefs.current[index] = element
            }}
            to={href}
            end={href === '/'}
            aria-label={label}
          >
            <Icon size={24} />
          </NavLink>
        ))}
      </lg-navbar>
    </div>
  )
}

export default MobileNav
