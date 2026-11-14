import { useLayoutEffect, useRef } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import logo from '@/assets/logo.svg'
import { homePath, navItems } from '@/navigation'
import './Navbar.css'

function Navbar() {
  const { pathname } = useLocation()

  const navRef = useRef<HTMLElement>(null)
  const indicatorRef = useRef<HTMLSpanElement>(null)
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([])

  const activeIndex = navItems.findIndex(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  )

  useLayoutEffect(() => {
    const updateIndicator = () => {
      const nav = navRef.current
      const indicator = indicatorRef.current
      const activeLink = linkRefs.current[activeIndex]
      if (!nav || !indicator) return

      indicator.style.opacity = activeLink ? '1' : '0'
      if (!activeLink) return

      const navRect = nav.getBoundingClientRect()
      const linkRect = activeLink.getBoundingClientRect()

      indicator.style.width = `${linkRect.width}px`
      indicator.style.transform = `translate3d(${linkRect.left - navRect.left}px, 0, 0)`
    }

    updateIndicator()

    const observer = new ResizeObserver(updateIndicator)
    if (navRef.current) observer.observe(navRef.current)

    window.addEventListener('resize', updateIndicator)
    void document.fonts?.ready.then(updateIndicator)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateIndicator)
    }
  }, [activeIndex])

  return (
    <header className="navbar">
      <Link className="navbar__logo" to={homePath} aria-label="Cinimate home">
        <img src={logo} alt="Cinimate" />
      </Link>

      <nav ref={navRef} className="navbar__nav" aria-label="Main">
        <span ref={indicatorRef} className="navbar__indicator" aria-hidden="true" />

        {navItems.map((item, index) => (
          <NavLink
            key={item.href}
            ref={(element) => {
              linkRefs.current[index] = element
            }}
            className="navbar__link"
            to={item.href}
            end={item.href === homePath}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <Link className="navbar__profile" to="/profile" aria-label="Open profile" />
    </header>
  )
}

export default Navbar
