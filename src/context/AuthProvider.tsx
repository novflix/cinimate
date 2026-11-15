import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { AuthContext, type AuthContextValue, type AuthUser } from './authContext'

function toAuthUser(user: User): AuthUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    emailVerified: user.emailVerified,
    createdAt: user.metadata.creationTime ?? null,
    lastLoginAt: user.metadata.lastSignInTime ?? null,
  }
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  // While registering, the nickname is written right after the account is created. Skipping the
  // intermediate auth event keeps the UI from flashing a user without a nickname.
  const registeringRef = useRef(false)

  useEffect(() => {
    return onAuthStateChanged(auth, (firebaseUser) => {
      if (registeringRef.current) return
      setUser(firebaseUser ? toAuthUser(firebaseUser) : null)
      setLoading(false)
    })
  }, [])

  const register = useCallback<AuthContextValue['register']>(async (nickname, email, password) => {
    registeringRef.current = true
    try {
      await setPersistence(auth, browserLocalPersistence)
      const credential = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(credential.user, { displayName: nickname })
      setUser(toAuthUser(credential.user))
      // The account is already created; a failed verification email must not fail registration.
      void sendEmailVerification(credential.user).catch(() => {})
    } finally {
      registeringRef.current = false
    }
  }, [])

  const login = useCallback<AuthContextValue['login']>(async (email, password, remember) => {
    await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence)
    await signInWithEmailAndPassword(auth, email, password)
  }, [])

  const logout = useCallback(async () => {
    await signOut(auth)
  }, [])

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, register, login, logout, resetPassword }),
    [user, loading, register, login, logout, resetPassword],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider
