// Thin wrapper exposing typed reads/writes against the Realtime Database.
// Individual domain services (teacher, course, month, payment, settings, export)
// implement specific business flows on top of this layer.
import { onValue, ref } from 'firebase/database'
import { db } from './firebase'

export function subscribe<T>(path: string, cb: (data: T) => void): () => void {
  const r = ref(db, path)
  const un = onValue(
    r,
    (snap) => {
      cb(snap.val() as T)
    },
    (err) => {
      cb(null as T)
      if (err) {
        // Surface connectivity issues via a custom event so the UI can react.
        window.dispatchEvent(new CustomEvent('firebase-error', { detail: err.message }))
      }
    },
  )
  return un
}
