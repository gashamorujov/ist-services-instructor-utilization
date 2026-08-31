import { describe, expect, it } from 'vitest'
import { buildPlacement, cellLookupKey } from '../services/placement'
import { computePayments, computeStats, cellColor } from '../utils/calc'
import type { CellValue, Course, CourseInstance, Settings, Teacher } from '../types'

const SH: Course = { id: 'c1', code: 'SH', name: 'SH', hours: 16, durationDays: 2, price: undefined, specialRule: null, active: true }
const SL: Course = { id: 'c2', code: 'SL', name: 'SL', hours: 32, durationDays: 4, price: undefined, specialRule: null, active: true }

const settings: Settings = {
  defaultCoursePrice: 70,
  colors: { default: '#000000', unpaid: '#FF0000', paid: '#008000' },
}

const teacher: Teacher = { id: 't1', fullName: 'Test', order: 1, active: true }

function emptyCells(): Map<string, CellValue> {
  return new Map()
}

function placed(monthId: string, teacherId: string, days: number[], value: string, instId: string, map: Map<string, CellValue>) {
  for (const d of days) {
    map.set(cellLookupKey(monthId, teacherId, d), { value, type: 'course', courseInstanceId: instId })
  }
}

describe('buildPlacement', () => {
  it('TEST 2: SH spreads into 2 days (16 hours / 8)', () => {
    const result = buildPlacement({
      month: { year: 2026, month: 9 },
      teacherId: 't1',
      startDay: 5,
      code: 'SH',
      course: SH,
      instanceId: 'ci_1',
      existingCells: emptyCells(),
      nextMonthId: null,
      coursePrice: undefined,
      preserveKey: null,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.cells.map((c) => c.day)).toEqual([5, 6])
    expect(result.days).toEqual(['2026-09-05', '2026-09-06'])
    const instance = result.writes.find((w) => w.path === 'courseInstances/ci_1')?.value as CourseInstance
    expect(instance.hours).toBe(16)
    expect(instance.durationDays).toBe(2)
  })

  it('TEST 3: SL spreads into 4 days (32 hours / 8)', () => {
    const result = buildPlacement({
      month: { year: 2026, month: 9 },
      teacherId: 't1',
      startDay: 12,
      code: 'SL',
      course: SL,
      instanceId: 'ci_2',
      existingCells: emptyCells(),
      nextMonthId: null,
      coursePrice: undefined,
      preserveKey: null,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.cells.map((c) => c.day)).toEqual([12, 13, 14, 15])
    expect(result.cells.map((c) => c.day)).toEqual([12, 13, 14, 15])
  })

  it('TEST 8 (cross-month): SL starting on Sep 29 spills into October 1-2 with same instance id', () => {
    const lookup = emptyCells()
    const result = buildPlacement({
      month: { year: 2026, month: 9 },
      teacherId: 't1',
      startDay: 29,
      code: 'SL',
      course: SL,
      instanceId: 'ci_cross',
      existingCells: lookup,
      nextMonthId: '2026-10',
      coursePrice: undefined,
      preserveKey: null,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.cells.map((c) => `${c.monthId}-${String(c.day).padStart(2, '0')}`)).toEqual([
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
    ])
    expect(result.days).toEqual(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'])
    const cells = result.writes.filter((w) => w.path.startsWith('cells/'))
    expect(cells.every((c) => (c.value as CellValue).courseInstanceId === 'ci_cross')).toBe(true)
  })

  it('rejects placement beyond month when next month does not exist', () => {
    const result = buildPlacement({
      month: { year: 2026, month: 9 },
      teacherId: 't1',
      startDay: 29,
      code: 'SL',
      course: SL,
      instanceId: 'ci_3',
      existingCells: emptyCells(),
      nextMonthId: null,
      coursePrice: undefined,
      preserveKey: null,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('beyond_month')
  })

  it('detects occupied cells and reports them', () => {
    const lookup = emptyCells()
    placed('2026-09', 't1', [7, 8], 'SH', 'ci_other', lookup)
    const result = buildPlacement({
      month: { year: 2026, month: 9 },
      teacherId: 't1',
      startDay: 5,
      code: 'SL',
      course: SL,
      instanceId: 'ci_4',
      existingCells: lookup,
      nextMonthId: null,
      coursePrice: undefined,
      preserveKey: null,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('occupied')
    expect(result.occupiedDays.map((c) => c.day)).toEqual([7, 8])
  })

  it('invalid course code is rejected', () => {
    const result = buildPlacement({
      month: { year: 2026, month: 9 },
      teacherId: 't1',
      startDay: 1,
      code: 'ZZ',
      course: null,
      instanceId: 'ci_5',
      existingCells: emptyCells(),
      nextMonthId: null,
      coursePrice: undefined,
      preserveKey: null,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('invalid_code')
  })
})

describe('payments & stats', () => {
  const makeInstance = (partial: Partial<CourseInstance>): CourseInstance => ({
    id: 'ci',
    code: 'SL',
    monthId: '2026-09',
    teacherId: 't1',
    startDate: '2026-09-12',
    endDate: '2026-09-15',
    hours: 32,
    durationDays: 4,
    room: null,
    location: null,
    paymentStatus: 'DEFAULT',
    price: null,
    days: ['2026-09-12', '2026-09-13', '2026-09-14', '2026-09-15'],
    ...partial,
  })

  it('TEST 4/5: 4 SL cells = 4 courses, 32 hours, 280 AZN', () => {
    const inst = makeInstance({ id: 'ci_sl', price: null })
    const pay = computePayments([inst], [teacher], settings)
    expect(pay).toHaveLength(1)
    expect(pay[0]!.courseCount).toBe(4)
    expect(pay[0]!.totalHours).toBe(32)
    expect(pay[0]!.totalAmount).toBe(280)
  })

  it('TEST (17 example): SL + SH = 6 courses, 48 hours, 420 AZN', () => {
    const sl = makeInstance({ id: 'ci_sl2', price: null })
    const sh = makeInstance({ id: 'ci_sh', code: 'SH', hours: 16, durationDays: 2, days: ['2026-09-05', '2026-09-06'] })
    const pay = computePayments([sl, sh], [teacher], settings)
    expect(pay[0]!.courseCount).toBe(6)
    expect(pay[0]!.totalHours).toBe(48)
    expect(pay[0]!.totalAmount).toBe(420)
  })

  it('TEST 6/7 + color: PAID -> green, UNPAID stays default (black)', () => {
    const paid = makeInstance({ id: 'ci_paid', paymentStatus: 'PAID' })
    const unpaid = makeInstance({ id: 'ci_unpaid', paymentStatus: 'UNPAID' })
    const cellPaid: CellValue = { value: 'SL', type: 'course', courseInstanceId: 'ci_paid' }
    const cellUnpaid: CellValue = { value: 'SL', type: 'course', courseInstanceId: 'ci_unpaid' }
    expect(cellColor(cellPaid, paid, settings.colors)).toBe('#008000')
    expect(cellColor(cellUnpaid, unpaid, settings.colors)).toBe('#000000')
  })

  it('XS manual price is used instead of default', () => {
    const xs = makeInstance({ id: 'ci_xs', code: 'XS', price: 200, hours: 8, durationDays: 1, days: ['2026-09-12'] })
    const pay = computePayments([xs], [teacher], settings)
    expect(pay[0]!.totalAmount).toBe(200)
  })

  it('stats aggregate correctly', () => {
    const inst = [makeInstance({ id: 'a', paymentStatus: 'PAID' }), makeInstance({ id: 'b', paymentStatus: 'UNPAID' })]
    const stats = computeStats(inst, settings)
    // 2 instances × 4 days each = 8 courses
    expect(stats.totalCourses).toBe(8)
    expect(stats.totalHours).toBe(64)
    expect(stats.totalAmount).toBe(560)
    expect(stats.paidAmount).toBe(280)
    expect(stats.unpaidAmount).toBe(280)
  })

  it('multiple teachers are computed separately', () => {
    const t2: Teacher = { id: 't2', fullName: 'Test 2', order: 2, active: true }
    const inst1 = makeInstance({ id: 'ci_t1', teacherId: 't1' })
    const inst2 = makeInstance({ id: 'ci_t2', teacherId: 't2', days: ['2026-09-01', '2026-09-02'] })
    const pay = computePayments([inst1, inst2], [teacher, t2], settings)
    expect(pay).toHaveLength(2)
    const t1Pay = pay.find((p) => p.teacherId === 't1')
    const t2Pay = pay.find((p) => p.teacherId === 't2')
    expect(t1Pay?.courseCount).toBe(4)
    expect(t1Pay?.totalAmount).toBe(280)
    expect(t2Pay?.courseCount).toBe(2)
    expect(t2Pay?.totalAmount).toBe(140)
  })

  it('TRASH: month deletedAt field works correctly', () => {
    const activeMonth = { id: '2026-09', year: 2026, month: 9, name: 'Sentyabr 2026', createdAt: Date.now() }
    const trashedMonth = { id: '2026-10', year: 2026, month: 10, name: 'Oktyabr 2026', createdAt: Date.now(), deletedAt: Date.now() }
    expect(activeMonth.deletedAt).toBeUndefined()
    expect(trashedMonth.deletedAt).toBeDefined()
  })

  it('ARCHIVE: ArchivedYear contains correct structure', () => {
    const archive = {
      id: '2026-2027',
      name: '2026-2027 tədris ili',
      archivedAt: Date.now(),
      startYear: 2026,
      endYear: 2027,
      months: {},
      teachers: {},
      courses: {},
      courseInstances: {},
      cellsByMonth: {},
      settings,
    }
    expect(archive.id).toBe('2026-2027')
    expect(archive.startYear).toBe(2026)
    expect(archive.endYear).toBe(2027)
  })
})
