import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { homePath } from '@/navigation'

interface RedirectState {
  from?: string
}

/** Routes inside are available to signed-in users only; guests are sent to the login page. */
export function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return null
  if (!user) {
    const state: RedirectState = { from: location.pathname + location.search }
    return <Navigate to="/login" replace state={state} />
  }

  return <Outlet />
}

/** Login and registration are for guests only; signed-in users go back where they came from. */
export function GuestOnly() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return null
  if (user) {
    const from = (location.state as RedirectState | null)?.from
    return <Navigate to={from ?? homePath} replace />
  }

  return <Outlet />
}
