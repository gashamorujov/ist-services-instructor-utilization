import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'

export type Role = 'admin' | 'user'

type Session = { name: string; role: Role }

type AuthContextValue = {
  session: Session
  isAdmin: boolean
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

// Bütün istifadəçilər administrator səlahiyyəti ilə birbaşa daxil olur.
const DEFAULT_SESSION: Session = { name: 'Administrator', role: 'admin' }

export function AuthProvider({ children }: { children: ReactNode }) {
  const value = useMemo<AuthContextValue>(
    () => ({ session: DEFAULT_SESSION, isAdmin: true, signOut: () => {} }),
    [],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
