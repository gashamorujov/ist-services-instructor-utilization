import { useMemo } from 'react'
import { BookOpen, Clock, CheckCircle2, Hourglass, Users, CalendarDays } from 'lucide-react'
import { useData } from '../store/DataContext'
import { computeStats, statusLabel } from '../utils/calc'

export function DashboardPage({ onOpenSchedule }: { onOpenSchedule: () => void }) {
  const { months, activeMonthId, teachers, courseInstances, settings } = useData()
  const currentMonth = activeMonthId ? months[activeMonthId] : undefined

  const instances = useMemo(() => {
    if (!currentMonth) return []
    return Object.values(courseInstances).filter((i) => i.monthId === currentMonth.id)
  }, [courseInstances, currentMonth])

  const stats = useMemo(() => computeStats(instances, settings), [instances, settings])
  const activeTeachers = useMemo(() => Object.values(teachers).filter((t) => t.active).length, [teachers])

  const cards = [
    { label: 'Cari ay', value: currentMonth?.name ?? '—', icon: <CalendarDays size={18} />, tone: 'text-brand-700 bg-brand-50' },
    { label: 'Aktiv müəllim sayı', value: String(activeTeachers), icon: <Users size={18} />, tone: 'text-indigo-700 bg-indigo-50' },
    { label: 'Kurs sayı', value: String(stats.totalCourses), icon: <BookOpen size={18} />, tone: 'text-amber-700 bg-amber-50' },
    { label: 'Ümumi dərs saatı', value: `${stats.totalHours} saat`, icon: <Clock size={18} />, tone: 'text-cyan-700 bg-cyan-50' },
    { label: 'Ödənilmiş məbləğ', value: `${stats.paidAmount} AZN`, icon: <CheckCircle2 size={18} />, tone: 'text-emerald-700 bg-emerald-50' },
    { label: 'Gözləyən ödəniş', value: `${stats.unpaidAmount} AZN`, icon: <Hourglass size={18} />, tone: 'text-red-700 bg-red-50' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-sm text-slate-500">Tədris yükünün ümumi vəziyyəti</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className={`mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg ${c.tone}`}>{c.icon}</div>
            <div className="text-lg font-bold text-slate-800">{c.value}</div>
            <div className="text-xs text-slate-500">{c.label}</div>
          </div>
        ))}
      </div>

      {instances.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-semibold text-slate-700">Bu ay üçün hələ heç bir kurs qeyd edilməyib.</p>
          <p className="mt-1 text-xs text-slate-400">Tədris cədvəlinə keçib kurs əlavə edə bilərsiniz.</p>
          <button
            onClick={onOpenSchedule}
            className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Tədris cədvəlinə keç
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-bold text-slate-800">Son kurslar — {currentMonth?.name}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-bold text-slate-600">
                  <th className="px-4 py-2">Kod</th>
                  <th className="px-4 py-2">Müəllim</th>
                  <th className="px-4 py-2">Başlama</th>
                  <th className="px-4 py-2">Bitmə</th>
                  <th className="px-4 py-2 text-center">Saat</th>
                  <th className="px-4 py-2 text-right">Qiymət</th>
                  <th className="px-4 py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {instances
                  .sort((a, b) => (a.startDate > b.startDate ? 1 : -1))
                  .slice(0, 15)
                  .map((inst) => (
                    <tr key={inst.id} className="border-t border-slate-100">
                      <td className="px-4 py-2 font-bold text-slate-800">{inst.code}</td>
                      <td className="px-4 py-2 text-slate-600">{teachers[inst.teacherId]?.fullName ?? '—'}</td>
                      <td className="px-4 py-2 text-slate-600">{inst.startDate}</td>
                      <td className="px-4 py-2 text-slate-600">{inst.endDate}</td>
                      <td className="px-4 py-2 text-center text-slate-600">{inst.hours}</td>
                      <td className="px-4 py-2 text-right font-semibold text-slate-800">{(inst.price ?? settings.defaultCoursePrice) * Math.max(1, inst.days.length)} AZN</td>
                      <td className="px-4 py-2 text-center">
                        <span
                          className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${
                            inst.paymentStatus === 'PAID'
                              ? 'bg-emerald-100 text-emerald-700'
                              : inst.paymentStatus === 'UNPAID'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {statusLabel(inst.paymentStatus)}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
