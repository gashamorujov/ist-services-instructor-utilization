import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useData } from '../store/DataContext'
import { useAuth } from '../store/AuthContext'
import { Button, Field, Input, PageHeader } from '../components/ui'
import type { Colors } from '../types'

export function SettingsPage() {
  const { settings, updateSettings, rooms, addRoom, deleteRoom } = useData()
  const { isAdmin } = useAuth()
  const [price, setPrice] = useState(String(settings.defaultCoursePrice))
  const [colors, setColors] = useState<Colors>(settings.colors)
  const [newRoom, setNewRoom] = useState('')

  const saveSettings = async () => {
    const p = parseFloat(price)
    await updateSettings({
      defaultCoursePrice: Number.isFinite(p) && p >= 0 ? p : 70,
      colors,
    })
  }

  if (!isAdmin) {
    return (
      <div className="space-y-5">
        <PageHeader title="Parametrlər" subtitle="Sistem parametrləri yalnız administrator tərəfindən idarə edilə bilər" />
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <p className="text-sm font-semibold text-slate-700">Bu bölmə yalnız administrator üçündür.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Parametrlər" subtitle="Sistem parametrlərini idarə edin" />

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-bold text-slate-800">Kurs qiyməti</h2>
        <Field label="Standart kurs qiyməti (AZN)" hint="XS kursları istisnadır — onlar üçün qiymət manual daxil edilir.">
          <Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} className="max-w-xs" />
        </Field>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-bold text-slate-800">Kurs rəngləri</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <ColorInput label="Default" value={colors.default} onChange={(v) => setColors({ ...colors, default: v })} />
          <ColorInput label="Unpaid (Ödənilməyib)" value={colors.unpaid} onChange={(v) => setColors({ ...colors, unpaid: v })} />
          <ColorInput label="Paid (Ödənilib)" value={colors.paid} onChange={(v) => setColors({ ...colors, paid: v })} />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-bold text-slate-800">Otaqlar</h2>
        <div className="mb-4 flex gap-2">
          <Input
            value={newRoom}
            onChange={(e) => setNewRoom(e.target.value)}
            placeholder="Yeni otaq adı"
            className="max-w-xs"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newRoom.trim()) {
                void addRoom(newRoom.trim())
                setNewRoom('')
              }
            }}
          />
          <Button
            onClick={() => {
              if (newRoom.trim()) {
                void addRoom(newRoom.trim())
                setNewRoom('')
              }
            }}
          >
            <Plus size={16} />
            Əlavə et
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.values(rooms).map((r) => (
            <div key={r.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5">
              <span className="text-sm text-slate-700">{r.name}</span>
              <button onClick={() => void deleteRoom(r.id)} className="text-slate-400 hover:text-red-500">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {Object.keys(rooms).length === 0 && <p className="text-sm text-slate-400">Heç bir otaq yoxdur.</p>}
        </div>
      </div>

      <Button onClick={() => void saveSettings()}>Yadda saxla</Button>
    </div>
  )
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded-md"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="flex-1 font-mono" />
      </div>
    </Field>
  )
}
