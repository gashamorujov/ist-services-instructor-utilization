import { useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useData } from '../store/DataContext'
import { Badge, Button, ConfirmDialog, PageHeader, Select } from '../components/ui'
import { computePayments, paymentRowStatus } from '../utils/calc'
import type { Month } from '../types'

export function PaymentsPage() {
  const { months, activeMonthId, setActiveMonthId, teachers, courseInstances, settings, deleteTeacherPayments } = useData()
  const [confirmDelete, setConfirmDelete] = useState<{ teacherId: string; name: string } | null>(null)

  const monthList = useMemo(() => Object.values(months).filter((m) => !m.deletedAt).sort((a, b) => a.id.localeCompare(b.id)), [months])
  const currentMonth: Month | undefined = activeMonthId ? months[activeMonthId] : undefined

  const instances = useMemo(() => {
    if (!currentMonth) return []
    return Object.values(courseInstances).filter((i) => i.monthId === currentMonth.id)
  }, [courseInstances, currentMonth])

  const activeTeachers = useMemo(
    () => Object.values(teachers).filter((t) => t.active).sort((a, b) => a.order - b.order),
    [teachers],
  )
  const payments = useMemo(
    () => computePayments(instances, activeTeachers, settings),
    [instances, activeTeachers, settings],
  )

  const handleDelete = (teacherId: string, name: string) => {
    setConfirmDelete({ teacherId, name })
  }

  const confirmDeleteAction = async () => {
    if (!confirmDelete || !currentMonth) return
    await deleteTeacherPayments(confirmDelete.teacherId, currentMonth.id)
    setConfirmDelete(null)
  }

  function paymentLabel(s: 'DEFAULT' | 'UNPAID' | 'PAID' | 'MIXED'): string {
    if (s === 'PAID') return 'Ödənilib'
    if (s === 'UNPAID') return 'Ödənilməyib'
    if (s === 'MIXED') return 'Qismən ödənilib'
    return 'Müəyyən edilməyib'
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ödənişlər"
        subtitle="Müəllimlərin ödəniş vəziyyəti"
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

      {payments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-semibold text-slate-700">Bu ay üçün hələ ödəniş yoxdur.</p>
          <p className="mt-1 text-xs text-slate-400">
            Tədris cədvəlində kurs əlavə etdikdə ödənişlər burada görünəcək.
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
                  <th className="px-4 py-2 text-right">Ümumi məbləğ (AZN)</th>
                  <th className="px-4 py-2 text-center">Ödəniş statusu</th>
                  <th className="px-4 py-2 text-center">Əməliyyat</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => {
                  const st = paymentRowStatus(p)
                  return (
                    <tr key={p.teacherId} className="border-t border-slate-100">
                      <td className="px-4 py-2 font-medium text-slate-800">{teachers[p.teacherId]?.fullName}</td>
                      <td className="px-4 py-2 text-center text-slate-600">{p.courseCount}</td>
                      <td className="px-4 py-2 text-center text-slate-600">{p.totalHours}</td>
                      <td className="px-4 py-2 text-right font-semibold text-slate-800">{p.totalAmount} AZN</td>
                      <td className="px-4 py-2 text-center">
                        <Badge tone={st === 'PAID' ? 'green' : st === 'UNPAID' ? 'red' : st === 'MIXED' ? 'amber' : 'slate'}>
                          {paymentLabel(st)}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(p.teacherId, teachers[p.teacherId]?.fullName ?? '')}
                          title="Ödənişi sil"
                        >
                          <Trash2 size={14} className="text-red-500" />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => void confirmDeleteAction()}
        title="Ödənişi sil"
        danger
        confirmLabel="Sil"
        message={
          <>
            <b>{confirmDelete?.name}</b> müəlliminin bu aya aid bütün ödəniş məlumatları silinəcək.
            Bütün kurslar tədris cədvəlindən çıxarılacaq. Davam etmək istəyirsiniz?
          </>
        }
      />
    </div>
  )
}
