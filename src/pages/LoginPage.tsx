import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LetterIcon } from '@solar-icons/react/linear/letter'
import { LockIcon } from '@solar-icons/react/linear/lock'
import AuthField from '@/components/AuthField/AuthField'
import AuthLayout from '@/components/AuthLayout/AuthLayout'
import { useAuth } from '@/hooks/useAuth'
import { getAuthErrorMessage } from '@/lib/authErrors'
import { isValidEmail } from '@/lib/validation'

function LoginPage() {
  const { login, resetPassword } = useAuth()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setNotice(null)

    if (!isValidEmail(email)) return setError('Enter a valid email address.')
    if (!password) return setError('Enter your password.')

    setBusy(true)
    try {
      // On success AuthGuard's <GuestOnly> redirects away from this page.
      await login(email.trim(), password, remember)
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const handleReset = async () => {
    setError(null)
    setNotice(null)

    if (!isValidEmail(email)) {
      return setError('Enter your email above first, then press “Forgot password?”.')
    }

    try {
      await resetPassword(email.trim())
      setNotice('If an account exists for this email, a reset link is on its way.')
    } catch (err) {
      setError(getAuthErrorMessage(err))
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Enter your email and password to continue">
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <AuthField
          Icon={LetterIcon}
          type="email"
          name="email"
          placeholder="Email address"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={setEmail}
        />

        <AuthField
          Icon={LockIcon}
          type="password"
          name="password"
          placeholder="Enter password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
        />

        <div className="auth-form__row">
          <label className="auth-check">
            <input
              className="visually-hidden"
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
            />
            <span className="auth-check__box" aria-hidden="true" />
            Remember me
          </label>

          <button type="button" className="auth-link" onClick={handleReset}>
            Forgot password?
          </button>
        </div>

        {error && (
          <p className="auth-message auth-message--error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="auth-message auth-message--success" role="status">
            {notice}
          </p>
        )}

        <button className="auth-submit" type="submit" disabled={busy}>
          {busy ? 'Please wait…' : 'Login'}
        </button>

        <p className="auth-footer">
          Don’t have an account?
          <Link className="auth-link" to="/register" state={location.state}>
            Create Account
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}

export default LoginPage
