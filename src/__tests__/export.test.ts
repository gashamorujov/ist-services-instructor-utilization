import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx-js-style'
import { buildMonthWorkbook, buildAllWorkbook } from '../services/exportService'
import type { CellValue, Course, CourseInstance, Month, Settings, Teacher } from '../types'

const month: Month = { id: '2026-09', year: 2026, month: 9, name: 'Sentyabr 2026', createdAt: 0 }
const teachers: Teacher[] = [{ id: 't1', fullName: 'Rəhimov Ehtiram', order: 1, active: true }]
const courses: Record<string, Course> = {}
const settings: Settings = { defaultCoursePrice: 70, colors: { default: '#000000', unpaid: '#FF0000', paid: '#008000' } }

const inst: CourseInstance = {
  id: 'ci_1',
  code: 'SL',
  monthId: '2026-09',
  teacherId: 't1',
  startDate: '2026-09-12',
  endDate: '2026-09-15',
  hours: 32,
  durationDays: 4,
  room: '1/3',
  location: 'Ramana',
  paymentStatus: 'PAID',
  price: null,
  days: ['2026-09-12', '2026-09-13', '2026-09-14', '2026-09-15'],
}

const cell: CellValue = { value: 'SL', type: 'course', courseInstanceId: 'ci_1' }
const cells: Record<string, Record<string, CellValue>> = {
  t1: { '12': cell, '13': cell, '14': cell, '15': cell },
}
const instances: Record<string, CourseInstance> = { ci_1: inst }

const data = { month, teachers, courses, cells, instances, settings }

describe('export', () => {
  it('TEST 16: builds a single-month workbook with header, days, payments', () => {
    const wb = buildMonthWorkbook(data)
    const ws = wb.Sheets['Sentyabr 2026']
    expect(ws).toBeTruthy()
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1 })
    // Title rows + header + teacher row + payments
    expect(rows.length).toBeGreaterThanOrEqual(10)
    expect(String(rows[0]?.[0])).toContain('IST Services')
    expect(String(rows[3]?.[1])).toContain('Full Name')
    expect(rows[3]?.[2]).toBe(1)
    // teacher row: day 12 has SL with room
    const teacherRow = rows[4]
    expect(teacherRow?.[1]).toBe('Rəhimov Ehtiram')
    expect(String(teacherRow?.[13])).toContain('SL')
    expect(String(teacherRow?.[13])).toContain('1/3')
    // payments section
    const payIdx = rows.findIndex((r) => r?.[0] === 'Müəllimlərin ödənişləri')
    expect(payIdx).toBeGreaterThan(0)
    const payRow = rows[payIdx + 2]
    expect(payRow?.[0]).toBe('Rəhimov Ehtiram')
    expect(payRow?.[1]).toBe(4)
    expect(payRow?.[2]).toBe(32)
    expect(payRow?.[3]).toBe(280)
    expect(String(payRow?.[4])).toContain('Ödənilib')
  })

  it('TEST 17: builds multi-month workbook with separate sheets', () => {
    const oct: Month = { ...month, id: '2026-10', month: 10, name: 'Oktyabr 2026' }
    const wb = buildAllWorkbook([data, { ...data, month: oct, cells: {}, instances: {} }])
    expect(wb.SheetNames).toContain('Sentyabr 2026')
    expect(wb.SheetNames).toContain('Oktyabr 2026')
  })
})
