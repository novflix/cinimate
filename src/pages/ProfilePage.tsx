import Avatar from '@/components/Avatar/Avatar'
import { useAuth } from '@/hooks/useAuth'

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString() : '—'
}

// Temporary page: raw account data plus a logout button. The real profile page comes later.
function ProfilePage() {
  const { user, logout } = useAuth()

  if (!user) return null

  return (
    <section style={{ width: 'var(--content-width)', margin: '0 auto', padding: '32px 0' }}>
      <Avatar name={user.displayName} size={72} />

      <h1>Profile</h1>
      <p>Nickname: {user.displayName ?? '—'}</p>
      <p>Email: {user.email ?? '—'}</p>
      <p>Email verified: {user.emailVerified ? 'yes' : 'no'}</p>
      <p>UID: {user.uid}</p>
      <p>Registered: {formatDate(user.createdAt)}</p>
      <p>Last sign-in: {formatDate(user.lastLoginAt)}</p>

      <button type="button" onClick={() => void logout()}>
        Log out
      </button>
    </section>
  )
}

export default ProfilePage
