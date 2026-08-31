import { useState } from 'react'
import { Layout } from './components/Layout'
import { useAuth } from './store/AuthContext'
import { DataProvider } from './store/DataContext'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { SchedulePage } from './pages/SchedulePage'
import { TeachersPage } from './pages/TeachersPage'
import { CoursesPage } from './pages/CoursesPage'
import { PaymentsPage } from './pages/PaymentsPage'
import { MonthsPage } from './pages/MonthsPage'
import { SettingsPage } from './pages/SettingsPage'

type PageKey = 'dashboard' | 'schedule' | 'teachers' | 'courses' | 'payments' | 'months' | 'settings'

export default function App() {
  const { session } = useAuth()
  const [page, setPage] = useState<PageKey>('schedule')

  if (!session) return <LoginPage />

  const openSchedule = () => setPage('schedule')

  return (
    <DataProvider>
      <Layout active={page} onNavigate={(k) => setPage(k as PageKey)}>
        {page === 'dashboard' && <DashboardPage onOpenSchedule={openSchedule} />}
        {page === 'schedule' && <SchedulePage />}
        {page === 'teachers' && <TeachersPage />}
        {page === 'courses' && <CoursesPage />}
        {page === 'payments' && <PaymentsPage />}
        {page === 'months' && <MonthsPage onOpenSchedule={openSchedule} />}
        {page === 'settings' && <SettingsPage />}
      </Layout>
    </DataProvider>
  )
}
