import { createContext } from 'react'

/** Plain snapshot of the signed-in user, so React re-renders when the profile changes. */
export interface AuthUser {
  uid: string
  email: string | null
  displayName: string | null
  emailVerified: boolean
  createdAt: string | null
  lastLoginAt: string | null
}

export interface AuthContextValue {
  user: AuthUser | null
  /** True until Firebase has restored (or ruled out) a previous session. */
  loading: boolean
  register: (nickname: string, email: string, password: string) => Promise<void>
  login: (email: string, password: string, remember: boolean) => Promise<void>
  logout: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
