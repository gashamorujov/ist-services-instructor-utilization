import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useData } from '../store/DataContext'
import { Badge, Button, ConfirmDialog, PageHeader } from '../components/ui'
import type { Month } from '../types'

export function MonthsPage({ onOpenSchedule }: { onOpenSchedule: () => void }) {
  const { months, addMonth, deleteMonth, activeMonthId, setActiveMonthId } = useData()
  const [confirm, setConfirm] = useState<Month | null>(null)
  const list = Object.values(months).sort((a, b) => a.id.localeCompare(b.id))

  return (
    <div className="space-y-5">
      <PageHeader
        title="Aylar"
        subtitle="Tədris aylarını idarə edin"
        actions={
          <Button onClick={() => void addMonth()}>
            <Plus size={16} />
            Növbəti ayı əlavə et
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((m) => (
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
                <Button variant="ghost" size="sm" onClick={() => setConfirm(m)}>
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
        {list.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="text-sm font-semibold text-slate-700">Hələ heç bir ay yoxdur.</p>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) void deleteMonth(confirm.id)
          setConfirm(null)
        }}
        title="Ayı sil"
        danger
        confirmLabel="Sil"
        message={
          <>
            <b>{confirm?.name}</b> ayını silmək üzrəsiniz. Bu aya aid bütün kurs və ödəniş məlumatları silinəcək.
            Davam etmək istəyirsiniz?
          </>
        }
      />
    </div>
  )
}
