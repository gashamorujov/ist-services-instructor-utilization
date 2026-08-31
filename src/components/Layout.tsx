import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  LayoutDashboard,
  Table2,
  Users,
  BookOpen,
  Wallet,
  CalendarRange,
  Settings,
  Menu,
  X,
  LogOut,
  Shield,
} from 'lucide-react'
import { useAuth } from '../store/AuthContext'

type NavItem = { key: string; label: string; icon: ReactNode }

const NAV: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { key: 'schedule', label: 'Tədris cədvəli', icon: <Table2 size={18} /> },
  { key: 'teachers', label: 'Müəllimlər', icon: <Users size={18} /> },
  { key: 'courses', label: 'Kurslar', icon: <BookOpen size={18} /> },
  { key: 'payments', label: 'Ödənişlər', icon: <Wallet size={18} /> },
  { key: 'months', label: 'Aylar', icon: <CalendarRange size={18} /> },
  { key: 'settings', label: 'Parametrlər', icon: <Settings size={18} /> },
]

export function Layout({
  active,
  onNavigate,
  children,
}: {
  active: string
  onNavigate: (key: string) => void
  children: ReactNode
}) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { session, isAdmin, signOut } = useAuth()

  const handleNav = (key: string) => {
    onNavigate(key)
    setDrawerOpen(false)
  }

  const nav = (
    <nav className="flex-1 space-y-1 px-3 py-4">
      {NAV.map((item) => (
        <button
          key={item.key}
          onClick={() => handleNav(item.key)}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            active === item.key
              ? 'bg-brand-600 text-white'
              : 'text-slate-300 hover:bg-slate-700/60 hover:text-white'
          }`}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </nav>
  )

  const footer = (
    <div className="border-t border-slate-700/60 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm text-white">
        <Shield size={16} className="text-slate-400" />
        <span className="font-medium">{session?.name ?? 'Qonaq'}</span>
      </div>
      <div className="mb-3 text-xs text-slate-400">
        {isAdmin ? 'Administrator' : 'İstifadəçi'}
      </div>
      <button
        onClick={signOut}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-300 hover:bg-slate-700/60 hover:text-white"
      >
        <LogOut size={16} />
        Çıxış
      </button>
    </div>
  )

  return (
    <div className="flex h-full bg-slate-100">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 flex-col bg-slate-900 lg:flex">
        <div className="flex items-center gap-3 border-b border-slate-700/60 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-extrabold text-white">
            IS
          </div>
          <div>
            <div className="text-sm font-bold text-white">IST Services</div>
            <div className="text-[11px] text-slate-400">Tədris yükünün idarəsi</div>
          </div>
        </div>
        {nav}
        {footer}
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fade-in absolute inset-0 bg-slate-900/60" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-72 flex-col bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-700/60 px-5 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-extrabold text-white">
                  IS
                </div>
                <span className="text-sm font-bold text-white">IST Services</span>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="text-slate-300" aria-label="Bağla">
                <X size={20} />
              </button>
            </div>
            {nav}
            {footer}
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <button onClick={() => setDrawerOpen(true)} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100" aria-label="Menyu">
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-xs font-extrabold text-white">
              IS
            </div>
            <span className="text-sm font-bold text-slate-800">IST Services</span>
          </div>
          <div className="w-8" />
        </div>
        <main className="min-w-0 flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}
