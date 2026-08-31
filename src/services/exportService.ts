import * as XLSX from 'xlsx-js-style'
import { computePayments, paymentRowStatus } from '../utils/calc'
import { monthName } from '../utils/dates'
import type { CellValue, Course, CourseInstance, Month, Settings, Teacher } from '../types'

type MonthData = {
  month: Month
  teachers: Teacher[]
  courses: Record<string, Course>
  cells: Record<string, Record<string, CellValue>>
  instances: Record<string, CourseInstance>
  settings: Settings
}

function lighten(hex: string, amount: number): string {
  const m = hex.replace('#', '')
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m
  const n = parseInt(full, 16)
  if (Number.isNaN(n)) return 'FFFFFF'
  const r = Math.min(255, ((n >> 16) & 255) + Math.round((255 - ((n >> 16) & 255)) * amount))
  const g = Math.min(255, ((n >> 8) & 255) + Math.round((255 - ((n >> 8) & 255)) * amount))
  const b = Math.min(255, (n & 255) + Math.round((255 - (n & 255)) * amount))
  return `FF${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

function fillColor(hex: string): string {
  return `FF${hex.replace('#', '')}`
}

function paymentLabel(s: 'DEFAULT' | 'UNPAID' | 'PAID' | 'MIXED'): string {
  if (s === 'PAID') return 'Ödənilib'
  if (s === 'UNPAID') return 'Ödənilməyib'
  if (s === 'MIXED') return 'Qismən ödənilib'
  return 'Müəyyən edilməyib'
}

function dayCount(month: Month): number {
  return new Date(month.year, month.month, 0).getDate()
}

/** Build the schedule sheet for a single month. */
function sheetForMonth(data: MonthData): XLSX.WorkSheet {
  const { month, cells, instances, settings } = data
  const dim = dayCount(month)
  const teachers = data.teachers.filter((t) => t.active)
  const rows: (string | number | null)[][] = []

  // ── Title ──
  rows.push([`Services — Tədris Cədvəli`])
  rows.push([])
  rows.push([`Instructor Utilization — ${month.name.toUpperCase()} tarixinə təlimatçıların tədris yükü`])
  rows.push([])

  // ── Header row ──
  const header: (string | number)[] = ['S/S', 'Ad Soyad', ...Array.from({ length: dim }, (_, i) => i + 1)]
  rows.push(header)

  // ── Teacher rows ──
  for (const t of teachers) {
    const row: (string | number | null)[] = [t.order, t.fullName]
    for (let d = 1; d <= dim; d++) {
      const cell = cells[t.id]?.[String(d)]
      if (cell?.value) {
        const inst = cell.courseInstanceId ? instances[cell.courseInstanceId] : undefined
        let text = cell.value
        const extras: string[] = []
        if (cell.location) extras.push(cell.location === 'Ramana' ? 'R' : 'E')
        if (inst?.room) extras.push(`Otaq: ${inst.room}`)
        if (extras.length) text += `\n(${extras.join(', ')})`
        row.push(text)
      } else {
        row.push(null)
      }
    }
    rows.push(row)
  }

  // ── Spacers ──
  rows.push([])
  rows.push([])

  // ── Payment section ──
  rows.push(['Ödənişlər'])
  rows.push([])
  rows.push(['Müəllim', 'Kurs sayı', 'Ümumi saat', 'Məbləğ (AZN)', 'Ödəniş statusu'])

  const payments = computePayments(Object.values(instances), teachers, settings)
  const teacherName = (id: string) => teachers.find((t) => t.id === id)?.fullName ?? id
  for (const p of payments) {
    rows.push([
      teacherName(p.teacherId),
      p.courseCount,
      p.totalHours,
      p.totalAmount,
      paymentLabel(paymentRowStatus(p)),
    ])
  }

  // ── Total row ──
  if (payments.length > 0) {
    rows.push([])
    const totalCourses = payments.reduce((s, p) => s + p.courseCount, 0)
    const totalHours = payments.reduce((s, p) => s + p.totalHours, 0)
    const totalAmount = payments.reduce((s, p) => s + p.totalAmount, 0)
    rows.push(['CƏMİ', totalCourses, totalHours, totalAmount, ''])
  }

  const ws = XLSX.utils.aoa_to_sheet(rows)

  // ── Column widths ──
  ws['!cols'] = [
    { wch: 5 },   // S/S
    { wch: 36 },  // Ad Soyad
    ...Array.from({ length: dim }, () => ({ wch: 12 })),
  ]

  const thin = 'thin' as const
  const grey = 'B0B7C3'
  const border = {
    top: { style: thin, color: { rgb: grey } },
    bottom: { style: thin, color: { rgb: grey } },
    left: { style: thin, color: { rgb: grey } },
    right: { style: thin, color: { rgb: grey } },
  } as const
  const center = { vertical: 'center', horizontal: 'center' } as const

  // ── Title styling ──
  const titleCell = ws['A1']
  if (titleCell) titleCell.s = { font: { bold: true, sz: 14, color: { rgb: '0F172A' } }, alignment: center }
  const subCell = ws['A3']
  if (subCell) subCell.s = { font: { bold: true, sz: 11, color: { rgb: '334155' } }, alignment: center }

  // ── Header row styling ──
  const headerRow = 4
  for (let c = 0; c < dim + 2; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: headerRow - 1, c })]
    if (cell) cell.s = { font: { bold: true, sz: 10, color: { rgb: '1F2933' } }, fill: { fgColor: { rgb: 'E2E8F0' } }, alignment: center, border }
  }

  // ── Grid cell styling ──
  for (let r = headerRow; r < headerRow + teachers.length; r++) {
    const ssn = ws[XLSX.utils.encode_cell({ r, c: 0 })]
    const name = ws[XLSX.utils.encode_cell({ r, c: 1 })]
    if (ssn) ssn.s = { alignment: center, border, font: { sz: 10 } }
    if (name) name.s = { alignment: { vertical: 'center', horizontal: 'left' }, border, font: { sz: 10 } }

    const t = teachers[r - headerRow]
    for (let d = 1; d <= dim; d++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c: d + 1 })]
      if (!cell) continue
      const val = cells[t.id]?.[String(d)]
      let color = settings.colors.default
      if (val?.courseInstanceId) {
        const inst = instances[val.courseInstanceId]
        if (inst?.paymentStatus === 'PAID') color = settings.colors.paid
        else if (inst?.paymentStatus === 'UNPAID') color = settings.colors.unpaid
      } else if (val?.value === 'X') {
        color = '#475569'
      }
      cell.s = {
        font: { bold: true, sz: 9, color: { rgb: fillColor(color).slice(2) } },
        fill: { fgColor: { rgb: lighten(color, 0.85) } },
        alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
        border,
      }
    }
  }

  // ── Payment section styling ──
  const payTitleRow = headerRow + teachers.length + 2
  const payHeaderRow = payTitleRow + 1
  const payDataStart = payHeaderRow + 1

  const payTitle = ws[XLSX.utils.encode_cell({ r: payTitleRow, c: 0 })]
  if (payTitle) payTitle.s = { font: { bold: true, sz: 12, color: { rgb: '0F172A' } } }

  for (let c = 0; c < 5; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: payHeaderRow, c })]
    if (cell) cell.s = { font: { bold: true, sz: 10, color: { rgb: '1F2933' } }, fill: { fgColor: { rgb: 'E2E8F0' } }, border, alignment: center }
  }

  for (let i = 0; i < payments.length; i++) {
    const r = payDataStart + i
    for (let c = 0; c < 5; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })]
      if (cell) cell.s = {
        border,
        alignment: c === 0 ? { vertical: 'center', horizontal: 'left' } : center,
        font: { sz: 10 },
      }
    }
  }

  // Total row
  if (payments.length > 0) {
    const totalRow = payDataStart + payments.length + 1
    for (let c = 0; c < 5; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: totalRow, c })]
      if (cell) cell.s = {
        font: { bold: true, sz: 10, color: { rgb: '0F172A' } },
        fill: { fgColor: { rgb: 'E2E8F0' } },
        border,
        alignment: c === 0 ? { vertical: 'center', horizontal: 'left' } : center,
      }
    }
  }

  // Merges
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: dim + 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: dim + 1 } },
  ]

  ws['!freeze'] = { xSplit: 2, ySplit: headerRow }
  ws['!pageSetup'] = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  ws['!margins'] = { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 }

  const lastRow = payments.length > 0 ? payDataStart + payments.length + 1 : payTitleRow
  ws['!printArea'] = `A1:${XLSX.utils.encode_cell({ r: lastRow, c: dim + 1 })}`

  return ws
}

function sheetName(month: Month): string {
  return `${monthName(month.month)} ${month.year}`
}

export function buildMonthWorkbook(data: MonthData): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  const ws = sheetForMonth(data)
  XLSX.utils.book_append_sheet(wb, ws, sheetName(data.month).slice(0, 31))
  return wb
}

export function exportMonthToExcel(data: MonthData) {
  const wb = buildMonthWorkbook(data)
  const fname = `Instructor_Utilization_${sheetName(data.month).replace(/ /g, '_')}.xlsx`
  XLSX.writeFile(wb, fname, { compression: true })
  return fname
}

export function buildAllWorkbook(dataList: MonthData[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  for (const data of dataList) {
    const ws = sheetForMonth(data)
    XLSX.utils.book_append_sheet(wb, ws, sheetName(data.month).slice(0, 31))
  }
  return wb
}

export function exportAllMonthsToExcel(dataList: MonthData[]) {
  const wb = buildAllWorkbook(dataList)
  const fname = 'Instructor_Utilization_Bütün_Aylar.xlsx'
  XLSX.writeFile(wb, fname, { compression: true })
  return fname
}
