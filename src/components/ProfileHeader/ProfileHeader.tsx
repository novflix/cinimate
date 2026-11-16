import type { ReactNode } from 'react'
import Avatar from '@/components/Avatar/Avatar'
import './ProfileHeader.css'

type ProfileHeaderProps = {
  name: string | null
  /** Secondary line under the nickname. */
  subtitle?: string
  /** Rendered in the banner's top-right corner (e.g. the log out button). */
  corner?: ReactNode
  /** The stats block: under the identity on phones, on the right of it on desktop. */
  children?: ReactNode
}

// The banner and the avatar are static for now; uploading custom ones comes later.
function ProfileHeader({ name, subtitle, corner, children }: ProfileHeaderProps) {
  return (
    <header className="profile-header">
      <div className="profile-header__banner" aria-hidden="true" />
      {corner && <div className="profile-header__corner">{corner}</div>}

      <div className="profile-header__body">
        <div className="profile-header__avatar">
          <Avatar name={name} />
        </div>

        <div className="profile-header__identity">
          <h1 className="profile-header__name">{name ?? 'Unnamed'}</h1>
          {subtitle && <p className="profile-header__subtitle">{subtitle}</p>}
        </div>

        {children && <div className="profile-header__aside">{children}</div>}
      </div>
    </header>
  )
}

export default ProfileHeader
