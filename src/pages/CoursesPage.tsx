import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useData } from '../store/DataContext'
import { useAuth } from '../store/AuthContext'
import { Badge, Button, ConfirmDialog, Field, Input, Modal, PageHeader } from '../components/ui'
import type { Course } from '../types'

const emptyForm = { code: '', name: '', hours: 8, price: '' }

export function CoursesPage() {
  const { courses, addCourse, updateCourse, deleteCourse } = useData()
  const { isAdmin } = useAuth()
  const [modal, setModal] = useState<null | { mode: 'add' } | { mode: 'edit'; course: Course }>(null)
  const [form, setForm] = useState(emptyForm)
  const [confirmDelete, setConfirmDelete] = useState<Course | null>(null)

  const list = Object.values(courses).sort((a, b) => a.code.localeCompare(b.code))

  const openAdd = () => {
    setForm(emptyForm)
    setModal({ mode: 'add' })
  }
  const openEdit = (c: Course) => {
    setForm({ code: c.code, name: c.name, hours: c.hours, price: c.price != null ? String(c.price) : '' })
    setModal({ mode: 'edit', course: c })
  }

  const save = async () => {
    if (!form.code.trim() || !form.name.trim()) return
    if (modal?.mode === 'add') {
      const price = form.price.trim() ? parseFloat(form.price) : undefined
      await addCourse({
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        hours: Math.max(1, form.hours),
        durationDays: Math.ceil(Math.max(1, form.hours) / 8),
        price: price != null && Number.isFinite(price) ? price : undefined,
        specialRule: null,
        active: true,
      })
    } else if (modal?.mode === 'edit' && modal.course) {
      const price = form.price.trim() ? parseFloat(form.price) : undefined
      await updateCourse(modal.course.id, {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        hours: Math.max(1, form.hours),
        durationDays: Math.ceil(Math.max(1, form.hours) / 8),
        price: price != null && Number.isFinite(price) ? price : undefined,
      })
    }
    setModal(null)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Kurslar"
        subtitle={`${list.filter((c) => c.active).length} aktiv kurs`}
        actions={
          isAdmin && (
            <Button onClick={openAdd}>
              <Plus size={16} />
              Kurs əlavə et
            </Button>
          )
        }
      />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-bold text-slate-600">
                <th className="px-4 py-2">Kod</th>
                <th className="px-4 py-2">Kurs adı</th>
                <th className="px-4 py-2 text-center">Saat</th>
                <th className="px-4 py-2 text-center">Gün</th>
                <th className="px-4 py-2 text-right">Qiymət</th>
                <th className="px-4 py-2">Xüsusi qayda</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-right">Əməliyyatlar</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-bold text-slate-800">{c.code}</td>
                  <td className="px-4 py-2 text-slate-600">{c.name}</td>
                  <td className="px-4 py-2 text-center text-slate-600">{c.hours}</td>
                  <td className="px-4 py-2 text-center text-slate-600">{c.durationDays}</td>
                  <td className="px-4 py-2 text-right font-semibold text-slate-800">
                    {c.price != null ? `${c.price} AZN` : 'Standart'}
                  </td>
                  <td className="px-4 py-2">
                    {c.specialRule === 'XS' && <Badge tone="amber">Manual qiymət</Badge>}
                  </td>
                  <td className="px-4 py-2">
                    <Badge tone={c.active ? 'green' : 'slate'}>{c.active ? 'Aktiv' : 'Deaktiv'}</Badge>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-2">
                      {isAdmin && (
                        <>
                          <Button variant="secondary" size="sm" onClick={() => openEdit(c)}>
                            <Pencil size={14} />
                            Redaktə et
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => void updateCourse(c.id, { active: !c.active })}>
                            {c.active ? 'Deaktiv et' : 'Aktiv et'}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(c)}>
                            <Trash2 size={14} className="text-red-500" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-400">
                    Heç bir kurs yoxdur.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.mode === 'add' ? 'Kurs əlavə et' : 'Kursu redaktə et'}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Kurs kodu">
            <Input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="Məs. SL"
              maxLength={5}
              autoFocus
            />
          </Field>
          <Field label="Saat">
            <Input
              type="number"
              min={1}
              value={form.hours}
              onChange={(e) => setForm({ ...form, hours: Number(e.target.value) })}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Kurs adı">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Kursun tam adı"
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Qiymət (AZN)" hint="Boş saxlanarsa standart qiymət tətbiq edilir.">
              <Input
                type="number"
                min={0}
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="70"
              />
            </Field>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setModal(null)}>Ləğv et</Button>
          <Button onClick={() => void save()}>Yadda saxla</Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) void deleteCourse(confirmDelete.id)
          setConfirmDelete(null)
        }}
        title="Kursu sil"
        danger
        confirmLabel="Sil"
        message={
          <>
            <b>{confirmDelete?.code} — {confirmDelete?.name}</b> silinəcək. Davam etmək istəyirsiniz?
          </>
        }
      />
    </div>
  )
}
