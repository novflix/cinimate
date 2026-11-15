import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { GuestOnly, RequireAuth } from '@/components/AuthGuard/AuthGuard'
import AuthProvider from '@/context/AuthProvider'
import AppLayout from '@/layouts/AppLayout'
import { homePath } from '@/navigation'
import ForYouPage from '@/pages/ForYouPage'
import HomePage from '@/pages/HomePage'
import LoginPage from '@/pages/LoginPage'
import ProfilePage from '@/pages/ProfilePage'
import RegisterPage from '@/pages/RegisterPage'
import SearchPage from '@/pages/SearchPage'
import SettingsPage from '@/pages/SettingsPage'
import TitlePage from '@/pages/TitlePage'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Guests only see the authentication screens. */}
          <Route element={<GuestOnly />}>
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
          </Route>

          {/* The whole service is behind the login. */}
          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route index element={<Navigate to={homePath} replace />} />
              <Route path={homePath} element={<HomePage />} />
              <Route path="recommendations" element={<ForYouPage />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="movie/:id" element={<TitlePage kind="movie" />} />
              <Route path="series/:id" element={<TitlePage kind="series" />} />
              <Route path="*" element={<Navigate to={homePath} replace />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
