import { useState } from 'react'
import { Layout } from './components/Layout'
import { DataProvider } from './store/DataContext'
import { DashboardPage } from './pages/DashboardPage'
import { SchedulePage } from './pages/SchedulePage'
import { TeachersPage } from './pages/TeachersPage'
import { CoursesPage } from './pages/CoursesPage'
import { PaymentsPage } from './pages/PaymentsPage'
import { MonthsPage } from './pages/MonthsPage'
import { SettingsPage } from './pages/SettingsPage'
import { ArchivePage } from './pages/ArchivePage'

type PageKey = 'dashboard' | 'schedule' | 'teachers' | 'courses' | 'payments' | 'months' | 'settings' | 'archive'

export default function App() {
  const [page, setPage] = useState<PageKey>('schedule')
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
        {page === 'archive' && <ArchivePage />}
        {page === 'settings' && <SettingsPage />}
      </Layout>
    </DataProvider>
  )
}
