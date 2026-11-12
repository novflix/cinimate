import { useRef } from 'react'
import { Outlet } from 'react-router-dom'
import MobileNav from '@/components/MobileNav/MobileNav'
import Navbar from '@/components/Navbar/Navbar'

function AppLayout() {
  const glassRootRef = useRef<HTMLDivElement>(null)

  return (
    <div className="app" ref={glassRootRef}>
      <div className="app__scene">
        <Navbar />
        <main className="page">
          <Outlet />
        </main>
      </div>
      <MobileNav glassRoot={glassRootRef} />
    </div>
  )
}

export default AppLayout
