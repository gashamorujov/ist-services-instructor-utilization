import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useData } from '../store/DataContext'
import { useAuth } from '../store/AuthContext'
import { Badge, Button, ConfirmDialog, Field, Input, Modal, PageHeader } from '../components/ui'
import type { Teacher } from '../types'

export function TeachersPage() {
  const { teachers, addTeacher, updateTeacher, deleteTeacher } = useData()
  const { isAdmin } = useAuth()
  const [modal, setModal] = useState<null | { mode: 'add' } | { mode: 'edit'; teacher: Teacher }>(null)
  const [name, setName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<Teacher | null>(null)

  const list = Object.values(teachers).sort((a, b) => a.order - b.order)

  const openAdd = () => {
    setName('')
    setModal({ mode: 'add' })
  }
  const openEdit = (t: Teacher) => {
    setName(t.fullName)
    setModal({ mode: 'edit', teacher: t })
  }

  const save = async () => {
    if (!name.trim()) return
    if (modal?.mode === 'add') await addTeacher(name.trim())
    else if (modal?.mode === 'edit') await updateTeacher(modal.teacher.id, { fullName: name.trim() })
    setModal(null)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Müəllimlər"
        subtitle={`${list.filter((t) => t.active).length} aktiv müəllim`}
        actions={
          isAdmin && (
            <Button onClick={openAdd}>
              <Plus size={16} />
              Müəllim əlavə et
            </Button>
          )
        }
      />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-bold text-slate-600">
                <th className="w-16 px-4 py-2">S/S</th>
                <th className="px-4 py-2">Ad Soyad</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-right">Əməliyyatlar</th>
              </tr>
            </thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-500">{t.order}</td>
                  <td className="px-4 py-2 font-medium text-slate-800">{t.fullName}</td>
                  <td className="px-4 py-2">
                    <Badge tone={t.active ? 'green' : 'slate'}>{t.active ? 'Aktiv' : 'Deaktiv'}</Badge>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-2">
                      {isAdmin && (
                        <>
                          <Button variant="secondary" size="sm" onClick={() => openEdit(t)}>
                            <Pencil size={14} />
                            Redaktə et
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void updateTeacher(t.id, { active: !t.active })}
                          >
                            {t.active ? 'Deaktiv et' : 'Aktiv et'}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(t)}>
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
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-400">
                    Heç bir müəllim yoxdur.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.mode === 'add' ? 'Müəllim əlavə et' : 'Müəllimi redaktə et'}>
        <Field label="Ad Soyad (S.A.A)">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Məs. Rəhimov Ehtiram Bəşir oğlu" autoFocus />
        </Field>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setModal(null)}>Ləğv et</Button>
          <Button onClick={() => void save()}>Yadda saxla</Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) void deleteTeacher(confirmDelete.id)
          setConfirmDelete(null)
        }}
        title="Müəllimi sil"
        danger
        confirmLabel="Sil"
        message={
          <>
            <b>{confirmDelete?.fullName}</b> silinəcək. Davam etmək istəyirsiniz?
          </>
        }
      />
    </div>
  )
}
