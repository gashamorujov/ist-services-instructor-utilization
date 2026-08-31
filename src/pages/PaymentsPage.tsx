import { useMemo } from 'react'
import { useData } from '../store/DataContext'
import { Badge, PageHeader, Select } from '../components/ui'
import { computePaidPayments } from '../utils/calc'
import type { Month } from '../types'

export function PaymentsPage() {
  const { months, activeMonthId, setActiveMonthId, teachers, courseInstances, settings } = useData()

  const monthList = useMemo(() => Object.values(months).sort((a, b) => a.id.localeCompare(b.id)), [months])
  const currentMonth: Month | undefined = activeMonthId ? months[activeMonthId] : undefined

  const instances = useMemo(() => {
    if (!currentMonth) return []
    return Object.values(courseInstances).filter((i) => i.monthId === currentMonth.id)
  }, [courseInstances, currentMonth])

  const activeTeachers = useMemo(
    () => Object.values(teachers).filter((t) => t.active).sort((a, b) => a.order - b.order),
    [teachers],
  )
  const paidPayments = useMemo(
    () => computePaidPayments(instances, activeTeachers, settings),
    [instances, activeTeachers, settings],
  )

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ödənişlər"
        subtitle="Ödənilmiş müəllim ödənişləri"
        actions={
          <Select value={activeMonthId ?? ''} onChange={(e) => setActiveMonthId(e.target.value)} className="w-48">
            {monthList.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        }
      />

      {paidPayments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-semibold text-slate-700">Bu ay üçün hələ ödəniş edilməyib.</p>
          <p className="mt-1 text-xs text-slate-400">
            Tədris cədvəlində kursu seçib "Ödənilib" olaraq işarələdikdə ödəniş burada görünəcək.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-bold text-slate-600">
                  <th className="px-4 py-2">Müəllim</th>
                  <th className="px-4 py-2 text-center">Kurs sayı</th>
                  <th className="px-4 py-2 text-center">Ümumi saat</th>
                  <th className="px-4 py-2 text-right">Məbləğ (AZN)</th>
                  <th className="px-4 py-2 text-center">Ödəniş statusu</th>
                </tr>
              </thead>
              <tbody>
                {paidPayments.map((p) => (
                  <tr key={p.teacherId} className="border-t border-slate-100">
                    <td className="px-4 py-2 font-medium text-slate-800">{teachers[p.teacherId]?.fullName}</td>
                    <td className="px-4 py-2 text-center text-slate-600">{p.courseCount}</td>
                    <td className="px-4 py-2 text-center text-slate-600">{p.totalHours}</td>
                    <td className="px-4 py-2 text-right font-semibold text-slate-800">{p.totalAmount} AZN</td>
                    <td className="px-4 py-2 text-center">
                      <Badge tone="green">Ödənilib</Badge>
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
