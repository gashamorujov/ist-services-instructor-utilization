import { useMemo, useState } from 'react'
import { Plus, Trash2, RotateCcw, Clock, AlertTriangle } from 'lucide-react'
import { useData } from '../store/DataContext'
import { Badge, Button, ConfirmDialog, PageHeader } from '../components/ui'
import type { Month } from '../types'

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000

function formatTimeRemaining(deletedAt: number): string {
  const elapsed = Date.now() - deletedAt
  const remaining = Math.max(0, TWENTY_FOUR_HOURS - elapsed)
  const hours = Math.floor(remaining / (1000 * 60 * 60))
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))
  if (hours > 0) return `${hours} saat ${minutes} dəqiqə`
  return `${minutes} dəqiqə`
}

export function MonthsPage({ onOpenSchedule }: { onOpenSchedule: () => void }) {
  const { months, addMonth, trashMonth, restoreMonth, permanentDeleteMonth, activeMonthId, setActiveMonthId } = useData()
  const [confirmTrash, setConfirmTrash] = useState<Month | null>(null)
  const [confirmPermanentDelete, setConfirmPermanentDelete] = useState<Month | null>(null)
  const [confirmRestore, setConfirmRestore] = useState<Month | null>(null)

  const activeMonths = useMemo(
    () => Object.values(months).filter((m) => !m.deletedAt).sort((a, b) => a.id.localeCompare(b.id)),
    [months],
  )
  const trashedMonths = useMemo(
    () => Object.values(months).filter((m) => !!m.deletedAt).sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0)),
    [months],
  )

  const handleAddMonth = async () => {
    const existing = Object.values(months)
    const sorted = existing.sort((a, b) => b.id.localeCompare(a.id))
    const last = sorted[0]
    if (last && !last.deletedAt) {
      const nm = (() => {
        const date = new Date(last.year, last.month, 1)
        return { year: date.getFullYear(), month: date.getMonth() + 1 }
      })()
      const nextId = `${nm.year}-${String(nm.month).padStart(2, '0')}`
      if (months[nextId]) {
        await addMonth()
        return
      }
    }
    await addMonth()
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Aylar"
        subtitle="Tədris aylarını idarə edin"
        actions={
          <Button onClick={() => void handleAddMonth()}>
            <Plus size={16} />
            Növbəti ayı əlavə et
          </Button>
        }
      />

      {/* Active months */}
      <div>
        <h2 className="mb-3 text-sm font-bold text-slate-600">Aktiv aylar</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {activeMonths.map((m) => (
            <div
              key={m.id}
              className={`rounded-xl border bg-white p-4 shadow-sm ${
                m.id === activeMonthId ? 'border-brand-500 ring-2 ring-brand-100' : 'border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-base font-bold text-slate-800">{m.name}</div>
                  <div className="text-xs text-slate-400">{new Date(m.year, m.month, 0).getDate()} gün</div>
                </div>
                <div className="flex gap-2">
                  {m.id === activeMonthId && <Badge tone="blue">Aktiv</Badge>}
                  <Button variant="ghost" size="sm" onClick={() => setConfirmTrash(m)} title="Zibil qutusuna köçür">
                    <Trash2 size={16} className="text-red-500" />
                  </Button>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setActiveMonthId(m.id)}>
                  Aç
                </Button>
                <Button variant="secondary" size="sm" onClick={onOpenSchedule}>
                  Cədvələ keç
                </Button>
              </div>
            </div>
          ))}
          {activeMonths.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <p className="text-sm font-semibold text-slate-700">Hələ heç bir ay yoxdur.</p>
              <p className="mt-1 text-xs text-slate-400">Yuxarıdakı düymə ilə yeni ay əlavə edin.</p>
            </div>
          )}
        </div>
      </div>

      {/* Trash bin */}
      {trashedMonths.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Trash2 size={16} className="text-slate-400" />
            <h2 className="text-sm font-bold text-slate-600">Zibil qutusu</h2>
            <Badge tone="slate">{trashedMonths.length}</Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {trashedMonths.map((m) => (
              <div
                key={m.id}
                className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-base font-bold text-slate-600">{m.name}</div>
                    <div className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                      <Clock size={12} />
                      {formatTimeRemaining(m.deletedAt ?? 0)} sonra avtomatik silinəcək
                    </div>
                  </div>
                  <AlertTriangle size={16} className="text-amber-400" />
                </div>
                <div className="mt-3 flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setConfirmRestore(m)}>
                    <RotateCcw size={14} />
                    Bərpa et
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => setConfirmPermanentDelete(m)}>
                    <Trash2 size={14} />
                    Həmişəlik sil
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trash confirm dialog */}
      <ConfirmDialog
        open={!!confirmTrash}
        onClose={() => setConfirmTrash(null)}
        onConfirm={() => {
          if (confirmTrash) void trashMonth(confirmTrash.id)
          setConfirmTrash(null)
        }}
        title="Ayı zibil qutusuna köçür"
        danger
        confirmLabel="Köçür"
        message={
          <>
            <b>{confirmTrash?.name}</b> ayı zibil qutusuna köçürülmək üzrədir.
            24 saat ərzində bərpa edə bilərsiniz. 24 saatdan sonra avtomatik olaraq həmişəlik silinəcək.
            Davam etmək istəyirsiniz?
          </>
        }
      />

      {/* Restore confirm dialog */}
      <ConfirmDialog
        open={!!confirmRestore}
        onClose={() => setConfirmRestore(null)}
        onConfirm={() => {
          if (confirmRestore) void restoreMonth(confirmRestore.id)
          setConfirmRestore(null)
        }}
        title="Ayı bərpa et"
        confirmLabel="Bərpa et"
        message={
          <>
            <b>{confirmRestore?.name}</b> ayı zibil qutusundan bərpa ediləcək.
            Bütün məlumatları ilə birlikdə aktiv aylara qayıdacaq. Davam etmək istəyirsiniz?
          </>
        }
      />

      {/* Permanent delete confirm dialog */}
      <ConfirmDialog
        open={!!confirmPermanentDelete}
        onClose={() => setConfirmPermanentDelete(null)}
        onConfirm={() => {
          if (confirmPermanentDelete) void permanentDeleteMonth(confirmPermanentDelete.id)
          setConfirmPermanentDelete(null)
        }}
        title="Ayı həmişəlik sil"
        danger
        confirmLabel="Həmişəlik sil"
        message={
          <>
            <b>{confirmPermanentDelete?.name}</b> ayı həmişəlik silinəcək.
            Bu əməliyyat geri qaytarıla bilməz. Bütün məlumatlar itiriləcək.
            Davam etmək istəyirsiniz?
          </>
        }
      />
    </div>
  )
}
