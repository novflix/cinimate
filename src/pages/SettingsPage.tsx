import { useState } from 'react'
import { Logout2Icon } from '@solar-icons/react/linear/logout-2'
import { useNavigate } from 'react-router-dom'
import Avatar from '@/components/Avatar/Avatar'
import { useAuth } from '@/hooks/useAuth'
import './SettingsPage.css'

function formatJoined(value: string | null): string | null {
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return `Joined ${date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
}

function SettingsPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  if (!user) return null

  const joined = formatJoined(user.createdAt)

  // Signing out lands on a clean login page, not one that sends the next user back here.
  const handleLogout = async () => {
    setBusy(true)
    try {
      await logout()
      navigate('/login', { replace: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="settings-page">
      <header className="settings-page__header">
        <h1 className="settings-page__title">Settings</h1>
        <p className="settings-page__subtitle">Manage your account and preferences.</p>
      </header>

      <section className="settings-card" aria-labelledby="settings-account">
        <div className="settings-card__head">
          <span className="settings-card__avatar">
            <Avatar name={user.displayName} />
          </span>

          <div className="settings-card__identity">
            <h2 className="settings-card__name" id="settings-account">
              {user.displayName ?? 'Your account'}
            </h2>
            {joined && <p className="settings-card__meta">{joined}</p>}
          </div>
        </div>

        <dl className="settings-list">
          <div className="settings-list__row">
            <dt className="settings-list__label">Email</dt>
            <dd className="settings-list__value">{user.email ?? 'Not set'}</dd>
          </div>
        </dl>

        <button
          type="button"
          className="settings-card__logout"
          onClick={() => void handleLogout()}
          disabled={busy}
        >
          <Logout2Icon size={18} aria-hidden="true" />
          {busy ? 'Logging out…' : 'Log out'}
        </button>
      </section>
    </div>
  )
}

export default SettingsPage
