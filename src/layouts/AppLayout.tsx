import { Outlet } from 'react-router-dom'
import MobileNav from '@/components/MobileNav/MobileNav'
import Navbar from '@/components/Navbar/Navbar'

function AppLayout() {
  return (
    <div className="app">
      <Navbar />
      <main className="page">
        <Outlet />
      </main>
      <MobileNav />
    </div>
  )
}

export default AppLayout
