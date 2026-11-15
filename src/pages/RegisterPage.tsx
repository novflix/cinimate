import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LetterIcon } from '@solar-icons/react/linear/letter'
import { LockIcon } from '@solar-icons/react/linear/lock'
import { UserIcon } from '@solar-icons/react/linear/user'
import AuthField from '@/components/AuthField/AuthField'
import AuthLayout from '@/components/AuthLayout/AuthLayout'
import { useAuth } from '@/hooks/useAuth'
import { getAuthErrorMessage } from '@/lib/authErrors'
import {
  isValidEmail,
  MAX_NICKNAME_LENGTH,
  MIN_NICKNAME_LENGTH,
  MIN_PASSWORD_LENGTH,
} from '@/lib/validation'

function RegisterPage() {
  const { register } = useAuth()
  const location = useLocation()

  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const name = nickname.trim()
    if (name.length < MIN_NICKNAME_LENGTH || name.length > MAX_NICKNAME_LENGTH) {
      return setError(`Nickname must be ${MIN_NICKNAME_LENGTH}–${MAX_NICKNAME_LENGTH} characters.`)
    }
    if (!isValidEmail(email)) return setError('Enter a valid email address.')
    if (password.length < MIN_PASSWORD_LENGTH) {
      return setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
    }
    if (password !== confirm) return setError('Passwords do not match.')

    setBusy(true)
    try {
      // On success AuthGuard's <GuestOnly> redirects away from this page.
      await register(name, email.trim(), password)
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title="Create an Account"
      subtitle="Provide your details, verify your email, and set a password"
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <AuthField
          Icon={UserIcon}
          name="nickname"
          placeholder="Enter your nickname"
          autoComplete="nickname"
          maxLength={MAX_NICKNAME_LENGTH}
          value={nickname}
          onChange={setNickname}
        />

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
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
        />

        <AuthField
          Icon={LockIcon}
          type="password"
          name="confirm-password"
          placeholder="Confirm password"
          autoComplete="new-password"
          value={confirm}
          onChange={setConfirm}
        />

        {error && (
          <p className="auth-message auth-message--error" role="alert">
            {error}
          </p>
        )}

        <button className="auth-submit" type="submit" disabled={busy}>
          {busy ? 'Please wait…' : 'Continue'}
        </button>

        <p className="auth-footer">
          Have an account?
          <Link className="auth-link" to="/login" state={location.state}>
            Log in
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}

export default RegisterPage
