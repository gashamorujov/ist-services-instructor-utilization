import { dateKey } from '../utils/dates'
import { genId } from '../utils/id'
import type { CellValue, Course, CourseInstance } from '../types'

export function cellPath(monthId: string, teacherId: string, day: number): string {
  return `cells/${monthId}/${teacherId}/${day}`
}

export function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

export type CellKey = { monthId: string; teacherId: string; day: number }

export function cellLookupKey(monthId: string, teacherId: string, day: number): string {
  return `${monthId}|${teacherId}|${day}`
}

export type PlaceResult =
  | {
      ok: true
      writes: { path: string; value: unknown }[]
      instanceId: string
      days: string[]
      cells: CellKey[]
    }
  | {
      ok: false
      reason: 'invalid_code' | 'occupied' | 'beyond_month'
      occupiedDays: CellKey[]
    }

export function buildPlacement(opts: {
  month: { year: number; month: number }
  teacherId: string
  startDay: number
  code: string
  course: Course | null
  instanceId: string
  existingCells: Map<string, CellValue>
  nextMonthId: string | null
  coursePrice: number | undefined
  preserveKey: string | null
}): PlaceResult {
  const { month, teacherId, startDay, course } = opts
  if (!course || !course.active) {
    return { ok: false, reason: 'invalid_code', occupiedDays: [] }
  }
  const duration = course.durationDays
  const dim = monthDays(month.year, month.month)
  const m1 = `${month.year}-${pad(month.month)}`

  const thisMonthKeys: CellKey[] = []
  const nextMonthKeys: CellKey[] = []
  for (let i = 0; i < duration; i++) {
    const day = startDay + i
    if (day <= dim) {
      thisMonthKeys.push({ monthId: m1, teacherId, day })
    } else {
      if (!opts.nextMonthId) return { ok: false, reason: 'beyond_month', occupiedDays: [] }
      const [ny, nm] = opts.nextMonthId.split('-').map(Number)
      nextMonthKeys.push({
        monthId: opts.nextMonthId,
        teacherId,
        day: new Date(ny, nm - 1, day - dim).getDate(),
      })
    }
  }

  const occupied: CellKey[] = []
  for (const ck of [...thisMonthKeys, ...nextMonthKeys]) {
    const key = cellLookupKey(ck.monthId, ck.teacherId, ck.day)
    const existing = opts.existingCells.get(key)
    if (existing && existing.value && key !== opts.preserveKey) {
      occupied.push(ck)
    }
  }
  if (occupied.length > 0) {
    return { ok: false, reason: 'occupied', occupiedDays: occupied }
  }

  const dates = [
    ...thisMonthKeys.map((k) => monthDate(k.monthId, k.day)),
    ...nextMonthKeys.map((k) => monthDate(k.monthId, k.day)),
  ]

  const writes: { path: string; value: unknown }[] = []
  const instance: CourseInstance = {
    id: opts.instanceId,
    code: course.code,
    monthId: m1,
    teacherId,
    startDate: dates[0] ?? '',
    endDate: dates[dates.length - 1] ?? '',
    hours: course.hours,
    durationDays: duration,
    room: null,
    location: null,
    paymentStatus: 'DEFAULT',
    price: opts.coursePrice ?? null,
    days: dates,
  }
  writes.push({ path: `courseInstances/${opts.instanceId}`, value: instance })

  const writeKeys = (keys: CellKey[]) => {
    for (const k of keys) {
      writes.push({
        path: cellPath(k.monthId, k.teacherId, k.day),
        value: { value: course.code, type: 'course', courseInstanceId: opts.instanceId },
      })
    }
  }
  writeKeys(thisMonthKeys)
  writeKeys(nextMonthKeys)

  return { ok: true, writes, instanceId: opts.instanceId, days: dates, cells: [...thisMonthKeys, ...nextMonthKeys] }
}

function monthDate(monthId: string, day: number): string {
  const [y, m] = monthId.split('-').map(Number)
  return dateKey(y, m, day)
}

function monthDays(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function newInstanceId(): string {
  return genId('ci')
}
