import { useState } from 'react'
import { Button, Field, Input, Modal, Select } from './ui'
import { useData } from '../store/DataContext'
import { statusLabel } from '../utils/calc'
import type { CourseInstance, PaymentStatus } from '../types'

export function CoursePanel({
  instanceId,
  onClose,
}: {
  instanceId: string | null
  onClose: () => void
}) {
  const { courseInstances, courses, teachers, rooms, settings, updateInstance, deleteInstance, toast } = useData()
  const inst: CourseInstance | undefined = instanceId ? courseInstances[instanceId] : undefined
  const course = inst ? Object.values(courses).find(c => c.code === inst.code) : undefined
  const [room, setRoom] = useState(inst?.room ?? '')
  const [status, setStatus] = useState<PaymentStatus>(inst?.paymentStatus ?? 'DEFAULT')
  const [price, setPrice] = useState(inst?.price != null ? String(inst.price) : '')
  const [location, setLocation] = useState<'Elmlər' | 'Ramana' | null>(inst?.location ?? null)

  if (!inst) {
    return (
      <Modal open title="Kurs məlumatı" onClose={onClose}>
        <p className="text-sm text-slate-500">Kurs mövcud deyil.</p>
      </Modal>
    )
  }

  const isXS = course?.code === 'XS' || course?.specialRule === 'XS'
  const isSLO = course?.code === 'SL' || course?.code === 'SO'
  const displayPrice = (inst.price ?? settings.defaultCoursePrice)?.toFixed(2).replace(/\.00$/, '') + ' AZN'

  const save = async () => {
    const patch: Partial<CourseInstance> = { paymentStatus: status }
    patch.room = room.trim() !== '' ? room.trim() : null
    if (isSLO) patch.location = location
    if (isXS) {
      const p = parseFloat(price)
      patch.price = Number.isFinite(p) && p >= 0 ? p : null
      if (patch.price == null) {
        toast('XS kursu üçün qiymət daxil edin.', 'error')
        return
      }
    }
    await updateInstance(inst.id, patch)
    toast('Kurs məlumatı yeniləndi')
    onClose()
  }

  const doDelete = async () => {
    const ok = window.confirm('Kursun bütün günlərini silmək istəyirsiniz?')
    if (!ok) return
    await deleteInstance(inst.id)
    onClose()
  }

  const roomNames = Object.values(rooms).map((r) => r.name)

  return (
    <Modal open title={`${inst.code} — Kurs məlumatı`} onClose={onClose} wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kurs kodu">
          <Input value={inst.code} disabled />
        </Field>
        <Field label="Kursun adı">
          <Input value={course?.name ?? ''} disabled />
        </Field>
        <Field label="Müəllim">
          <Input value={teachers[inst.teacherId]?.fullName ?? ''} disabled />
        </Field>
        <Field label="Başlama tarixi">
          <Input value={inst.startDate} disabled />
        </Field>
        <Field label="Bitmə tarixi">
          <Input value={inst.endDate} disabled />
        </Field>
        <Field label="Kurs müddəti">
          <Input value={`${inst.durationDays} gün`} disabled />
        </Field>

        <Field label="Otaq">
          <Input
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            placeholder="Məs. 1/3"
            list="room-options"
          />
          <datalist id="room-options">
            {roomNames.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </Field>
        {isSLO && (
          <Field label="Keçirilmə yeri">
            <div className="flex gap-2">
              <Button variant={location === 'Elmlər' ? 'primary' : 'secondary'} onClick={() => setLocation('Elmlər')}>
                Elmlər
              </Button>
              <Button variant={location === 'Ramana' ? 'primary' : 'secondary'} onClick={() => setLocation('Ramana')}>
                Ramana
              </Button>
            </div>
          </Field>
        )}
        <Field label="Ödəniş statusu">
          <Select value={status} onChange={(e) => setStatus(e.target.value as PaymentStatus)}>
            <option value="DEFAULT">Müəyyən edilməyib</option>
            <option value="UNPAID">Ödənilməyib</option>
            <option value="PAID">Ödənilib</option>
          </Select>
        </Field>
        <Field label={isXS ? 'Qiymət (AZN) — manual' : 'Qiymət (AZN)'} hint={isXS ? 'XS kursu üçün qiymət tələb olunur.' : 'Standart qiymət avtomatik tətbiq edilir.'}>
          {isXS ? (
            <Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />
          ) : (
            <Input value={displayPrice} disabled />
          )}
        </Field>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
        <Button onClick={save}>Yadda saxla</Button>
        <Button variant="danger" onClick={doDelete}>Kursu sil</Button>
      </div>
      <p className="mt-2 text-xs text-slate-400">Status: {statusLabel(status)}</p>
    </Modal>
  )
}
