import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from '@/layouts/AppLayout'
import ForYouPage from '@/pages/ForYouPage'
import HomePage from '@/pages/HomePage'
import ProfilePage from '@/pages/ProfilePage'
import SearchPage from '@/pages/SearchPage'
import SettingsPage from '@/pages/SettingsPage'
import TitlePage from '@/pages/TitlePage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="recommendations" element={<ForYouPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="movie/:id" element={<TitlePage kind="movie" />} />
          <Route path="series/:id" element={<TitlePage kind="series" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App