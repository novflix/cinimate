import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

// Firebase config values are not secrets: they end up in the client bundle anyway, and access is
// enforced by Firebase security rules and the authorized-domains list in the console. They only
// live in env vars so project-specific identifiers stay out of the source tree (see .env.example).
const env = import.meta.env

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing Firebase config "${name}". Add it to .env.local (see .env.example).`)
  }

  return value
}

const firebaseConfig = {
  apiKey: requireEnv('VITE_FIREBASE_API_KEY', env.VITE_FIREBASE_API_KEY),
  authDomain: requireEnv('VITE_FIREBASE_AUTH_DOMAIN', env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: requireEnv('VITE_FIREBASE_PROJECT_ID', env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: requireEnv('VITE_FIREBASE_STORAGE_BUCKET', env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: requireEnv(
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  ),
  appId: requireEnv('VITE_FIREBASE_APP_ID', env.VITE_FIREBASE_APP_ID),
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
