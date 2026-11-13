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

function MobileNav() {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const { pathname } = useLocation()

  const navRef = useRef<LgNavbarElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const [navReady, setNavReady] = useState(false)

  const isSearch = pathname.startsWith('/search')
  const activeIndex = items.findIndex((item) =>
    item.href === '/' ? pathname === '/' : pathname.startsWith(item.href),
  )

  // Upgrading <lg-navbar> adds a refracted copy of the icons and the sliding lens. The module is
  // loaded on the client only, once, and the element upgrades in place on subsequent mounts.
  useEffect(() => {
    if (!isMobile) return

    let disposed = false
    const search = searchRef.current
    let glass: LiquidGlassController | null = null

    void import('@/vendor/components.js').then(({ createGlass }) => {
      if (disposed) return
      if (search) glass = createGlass(search, searchGlass)
      setNavReady(true)
    })

    return () => {
      disposed = true
      glass?.destroy()
      glass = null
    }
  }, [isMobile])

  useLayoutEffect(() => {
    if (!isMobile || !navReady) return

    const nav = navRef.current
    if (!nav || activeIndex < 0) return

    nav.setCurrent(activeIndex)
  }, [activeIndex, isMobile, navReady])

  if (!isMobile) return null

  return (
    <>
      <div className="mobile-nav__glow" aria-hidden="true" />

      <div ref={searchRef} className="mobile-nav__search-bg" aria-hidden="true" />

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
        {items.map(({ label, href, Icon }) => (
          <NavLink key={href} to={href} end={href === '/'} aria-label={label}>
            <Icon size={24} />
          </NavLink>
        ))}
      </lg-navbar>
    </>
  )
}

export default MobileNav
