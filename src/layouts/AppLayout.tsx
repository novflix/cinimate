import { Outlet } from 'react-router-dom'
import MobileNav from '@/components/MobileNav/MobileNav'
import Navbar from '@/components/Navbar/Navbar'
import RatingModal from '@/components/RatingModal/RatingModal'

function AppLayout() {
  return (
    <div className="app">
      <Navbar />
      <main className="page">
        <Outlet />
      </main>
      <MobileNav />
      <RatingModal />
    </div>
  )
}

export default AppLayout
