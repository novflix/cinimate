import type { CSSProperties, ReactNode } from 'react'
import AuthPitch from '@/components/AuthPitch/AuthPitch'
import AuthShowcase from '@/components/AuthShowcase/AuthShowcase'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import './AuthLayout.css'

// Enough columns to cover very wide screens; the extra ones are clipped.
const DRIP_COUNT = 40

interface AuthLayoutProps {
  title: string
  subtitle: string
  children: ReactNode
}

function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  // The poster wall only exists on desktop, so phones never download it.
  const isDesktop = useMediaQuery('(min-width: 900px)')

  return (
    <div className="auth-page">
      {isDesktop && <AuthShowcase />}

      {!isDesktop && (
        <div className="auth-page__drips" aria-hidden="true">
          {Array.from({ length: DRIP_COUNT }, (_, index) => (
            <span key={index} style={{ '--i': index } as CSSProperties} />
          ))}
        </div>
      )}

      <div className="auth-page__stage">
        {isDesktop && <AuthPitch />}

        <main className="auth-page__content">
          <h1 className="auth-page__title">{title}</h1>
          <p className="auth-page__subtitle">{subtitle}</p>
          {children}
        </main>
      </div>

      <svg
        className="auth-page__wave"
        viewBox="0 0 402 101"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          className="auth-page__wave-shadow"
          d="M0 0 C60 32 130 54 210 49 C290 44 345 14 402 3 V101 H0 Z"
        />
        <path d="M0 0 C60 22 120 40 190 38 C270 36 335 8 402 0 V101 H0 Z" />
      </svg>
    </div>
  )
}

export default AuthLayout
