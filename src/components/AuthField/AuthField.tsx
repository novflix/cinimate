import { useState, type ComponentType, type InputHTMLAttributes } from 'react'
import { EyeIcon } from '@solar-icons/react/linear/eye'
import { EyeClosedIcon } from '@solar-icons/react/linear/eye-closed'
import './AuthField.css'

interface AuthFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type' | 'value'> {
  Icon: ComponentType<{ size?: number }>
  type?: 'text' | 'email' | 'password'
  value: string
  onChange: (value: string) => void
}

function AuthField({ Icon, type = 'text', value, onChange, ...inputProps }: AuthFieldProps) {
  const [revealed, setRevealed] = useState(false)
  const isPassword = type === 'password'

  return (
    <label className="auth-field">
      <Icon size={20} />

      <input
        {...inputProps}
        className="auth-field__input"
        type={isPassword && revealed ? 'text' : type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />

      {isPassword && (
        <button
          type="button"
          className="auth-field__toggle"
          aria-label={revealed ? 'Hide password' : 'Show password'}
          aria-pressed={revealed}
          onClick={() => setRevealed((current) => !current)}
        >
          {revealed ? <EyeClosedIcon size={22} /> : <EyeIcon size={22} />}
        </button>
      )}
    </label>
  )
}

export default AuthField
