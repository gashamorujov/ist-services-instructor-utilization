import { getAuth, signInAnonymously } from 'firebase/auth'
import { app } from './firebase'

let authed = false

/**
 * Attempts anonymous Firebase Authentication so writes are authenticated when
 * the project has anonymous auth enabled. Fails silently: the app keeps
 * working against an open Realtime Database (see README re: security rules).
 */
export async function ensureFirebaseAuth(): Promise<boolean> {
  if (authed) return true
  try {
    const auth = getAuth(app)
    if (!auth.currentUser) {
      await signInAnonymously(auth)
    }
    authed = true
    return true
  } catch {
    return false
  }
}
