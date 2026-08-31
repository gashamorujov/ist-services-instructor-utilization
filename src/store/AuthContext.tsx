import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export type Role = 'admin' | 'user'

type Session = { name: string; role: Role } | null

type AuthContextValue = {
  session: Session
  isAdmin: boolean
  signIn: (userType: 'admin' | 'user', name: string) => void
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const STORAGE_KEY = 'ists_util_session'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? (JSON.parse(raw) as Session) : null
    } catch {
      return null
    }
  })

  const signIn = useCallback((role: Role, name: string) => {
    const s: Session = { name: name.trim() || (role === 'admin' ? 'Administrator' : 'İstifadəçi'), role }
    setSession(s)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    } catch { /* ignore */ }
  }, [])

  const signOut = useCallback(() => {
    setSession(null)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch { /* ignore */ }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ session, isAdmin: session?.role === 'admin', signIn, signOut }),
    [session, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
