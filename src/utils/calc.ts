import type {
  CellValue,
  Course,
  CourseInstance,
  Colors,
  PaymentRow,
  Settings,
  Teacher,
} from '../types'

export function makeCell(value: string, type: 'course' | 'x', courseInstanceId: string | null): CellValue {
  return { value, type, courseInstanceId }
}

export function emptyCell(): CellValue {
  return makeCell('', 'x', null)
}

export function isX(cell: CellValue | undefined): boolean {
  return !!cell && cell.type === 'x' && cell.value.toUpperCase() === 'X'
}

export function isCourseCell(cell: CellValue | undefined): boolean {
  return !!cell && cell.type === 'course' && !!cell.courseInstanceId
}

/** Cell background color based on the linked course instance payment status. */
export function cellColor(
  cell: CellValue | undefined,
  instance: CourseInstance | undefined,
  colors: Colors,
): string {
  if (!cell || !cell.value) return 'transparent'
  if (isCourseCell(cell)) {
    const status = instance?.paymentStatus ?? 'DEFAULT'
    if (status === 'PAID') return colors.paid
    // UNPAID cells stay visually neutral (same as other cells)
    return colors.default
  }
  if (isX(cell)) return '#e2e8f0'
  // XS / standalone course value that has no resolved instance yet
  return colors.default
}

/** Compute per-teacher payment rows from course instances for a month. */
export function computePayments(
  instances: CourseInstance[],
  teachers: Teacher[],
  settings: Settings,
): PaymentRow[] {
  const map = new Map<string, PaymentRow>()
  const rowFor = (teacherId: string): PaymentRow => {
    let r = map.get(teacherId)
    if (!r) {
      r = {
        teacherId,
        courseCount: 0,
        totalHours: 0,
        totalAmount: 0,
        hasUnpaid: false,
        hasPaid: false,
      }
      map.set(teacherId, r)
    }
    return r
  }

  for (const inst of instances) {
    const row = rowFor(inst.teacherId)
    // Hər kurs xanası (günü) 1 kurs sayılır: məs. SL SL SL SL = 4 kurs
    const cellCount = Math.max(1, inst.days.length)
    const pricePerCell = inst.price ?? settings.defaultCoursePrice
    row.courseCount += cellCount
    row.totalHours += inst.hours
    row.totalAmount += pricePerCell * cellCount
    if (inst.paymentStatus === 'PAID') row.hasPaid = true
    if (inst.paymentStatus === 'UNPAID') row.hasUnpaid = true
  }

  const activeIds = new Set(teachers.filter((t) => t.active).map((t) => t.id))
  return Array.from(map.values())
    .filter((r) => activeIds.has(r.teacherId))
    .map((r) => ({ ...r }))
}

/** Active (unpaid / pending) payments per teacher — shown under the schedule. */
export function computeActivePayments(
  instances: CourseInstance[],
  teachers: Teacher[],
  settings: Settings,
): PaymentRow[] {
  return computePayments(
    instances.filter((i) => i.paymentStatus !== 'PAID'),
    teachers,
    settings,
  )
}

/** Paid payments per teacher — shown in the Ödənişlər page. */
export function computePaidPayments(
  instances: CourseInstance[],
  teachers: Teacher[],
  settings: Settings,
): PaymentRow[] {
  return computePayments(
    instances.filter((i) => i.paymentStatus === 'PAID'),
    teachers,
    settings,
  )
}

export type DashboardStats = {
  totalCourses: number
  totalHours: number
  totalAmount: number
  paidAmount: number
  unpaidAmount: number
  pendingCount: number
}

export function computeStats(instances: CourseInstance[], settings: Settings): DashboardStats {
  let totalCourses = 0
  let totalHours = 0
  let totalAmount = 0
  let paidAmount = 0
  let unpaidAmount = 0
  let pendingCount = 0
  for (const inst of instances) {
    const price = inst.price ?? settings.defaultCoursePrice
    const cellCount = Math.max(1, inst.days.length)
    totalCourses += cellCount
    totalHours += inst.hours
    totalAmount += price * cellCount
    if (inst.paymentStatus === 'PAID') paidAmount += price * cellCount
    else {
      unpaidAmount += price * cellCount
      pendingCount += cellCount
    }
  }
  return { totalCourses, totalHours, totalAmount, paidAmount, unpaidAmount, pendingCount }
}

/** Tooptip / display text for a cell. */
export function cellTooltip(
  cell: CellValue | undefined,
  instance: CourseInstance | undefined,
  course: Course | undefined,
  settings: Settings,
): string {
  if (!cell) return ''
  if (isX(cell)) return 'Müəllim bu gün dərs keçə bilməyəcək'
  if (isCourseCell(cell) && instance && course) {
    const lines = [
      `${course.code} — ${course.name}`,
      `Saat: ${instance.hours}`,
      `Gün: ${instance.durationDays}`,
      `Qiymət: ${instance.price ?? settings.defaultCoursePrice} AZN`,
      `Status: ${statusLabel(instance.paymentStatus)}`,
    ]
    if (instance.room) lines.push(`Otaq: ${instance.room}`)
    if (instance.location) lines.push(`Keçirilmə yeri: ${instance.location}`)
    return lines.join('\n')
  }
  return cell.value
}

export function statusLabel(status: 'DEFAULT' | 'UNPAID' | 'PAID'): string {
  if (status === 'PAID') return 'Ödənilib'
  if (status === 'UNPAID') return 'Ödənilməyib'
  return 'Müəyyən edilməyib'
}

export function paymentRowStatus(r: PaymentRow): 'DEFAULT' | 'UNPAID' | 'PAID' | 'MIXED' {
  if (r.hasPaid && r.hasUnpaid) return 'MIXED'
  if (r.hasUnpaid) return 'UNPAID'
  if (r.hasPaid) return 'PAID'
  return 'DEFAULT'
}
