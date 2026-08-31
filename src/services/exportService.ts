import * as XLSX from 'xlsx-js-style'
import { computePayments, paymentRowStatus } from '../utils/calc'
import { monthName } from '../utils/dates'
import type { CellValue, Course, CourseInstance, Month, Settings, Teacher } from '../types'

type MonthData = {
  month: Month
  teachers: Teacher[]
  courses: Record<string, Course>
  cells: Record<string, Record<string, CellValue>> // teacherId -> dayKey -> cell
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

function sheetForMonth(data: MonthData): XLSX.WorkSheet {
  const { month, cells, instances, settings } = data
  const dim = dayCount(month)
  const teachers = data.teachers.filter((t) => t.active)
  const rows: (string | number | null)[][] = []

  // Título
  rows.push(['IST Services Əlavə Təhsil Mərkəzi'])
  rows.push([])
  rows.push([`Instructor Utilization for ${month.name.toUpperCase()} -cı il tarixinə təlimatçıların tədris yükü`])
  const header = ['S/S', 'Full Name/ S.A.A', ...Array.from({ length: dim }, (_, i) => i + 1)]
  rows.push(header)

  for (const t of teachers) {
    const row: (string | number | null)[] = [t.order, t.fullName]
    for (let d = 1; d <= dim; d++) {
      const cell = cells[t.id]?.[String(d)]
      if (cell?.value) {
        const inst = cell.courseInstanceId ? instances[cell.courseInstanceId] : undefined
        let text = cell.value
        const extras: string[] = []
        if (inst?.room) extras.push(`Otaq: ${inst.room}`)
        if (inst?.location) extras.push(inst.location)
        const second = extras.length ? `\n${extras.join(', ')}` : ''
        row.push(`${text}${second}`)
      } else {
        row.push(null)
      }
    }
    rows.push(row)
  }

  rows.push([])
  rows.push([])
  rows.push(['Müəllimlərin ödənişləri'])
  rows.push(['Müəllim', 'Kurs sayı', 'Ümumi saat', 'Məbləğ (AZN)', 'Ödəniş statusu'])
  const payments = computePayments(
    Object.values(instances),
    teachers,
    settings,
  )
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

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [
    { wch: 6 },
    { wch: 34 },
    ...Array.from({ length: dim }, () => ({ wch: 9 })),
    { wch: 26 },
    { wch: 12 },
    { wch: 13 },
    { wch: 16 },
  ]

  const border = {
    top: { style: 'thin', color: { rgb: 'B0B7C3' } },
    bottom: { style: 'thin', color: { rgb: 'B0B7C3' } },
    left: { style: 'thin', color: { rgb: 'B0B7C3' } },
    right: { style: 'thin', color: { rgb: 'B0B7C3' } },
  } as const

  // Style title rows
  const center = { vertical: 'center', horizontal: 'center' } as const
  for (let c = 0; c < dim + 5; c++) {
    const titleCell = ws[XLSX.utils.encode_cell({ r: 0, c })]
    if (titleCell) {
      titleCell.s = {
        font: { bold: true, sz: 14 },
        alignment: center,
      }
    }
  }
  const subCell = ws[XLSX.utils.encode_cell({ r: 2, c: 0 })]
  if (subCell) {
    subCell.s = { font: { bold: true, sz: 12 }, alignment: center }
  }

  // Column header style
  for (let c = 0; c < dim + 2; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 3, c })]
    if (cell) {
      cell.s = {
        font: { bold: true, color: { rgb: '1F2933' } },
        fill: { fgColor: { rgb: 'E2E8F0' } },
        alignment: center,
        border,
      }
    }
  }

  // Grid cells
  for (let r = 4; r < 4 + teachers.length; r++) {
    const ssn = ws[XLSX.utils.encode_cell({ r, c: 0 })]
    const name = ws[XLSX.utils.encode_cell({ r, c: 1 })]
    if (ssn) ssn.s = { alignment: center, border }
    if (name) name.s = { alignment: { vertical: 'center', horizontal: 'left' }, border }
    const t = teachers[r - 4]
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
        font: { bold: true, color: { rgb: fillColor(color).slice(2) } },
        fill: { fgColor: { rgb: lighten(color, 0.85) } },
        alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
        border,
      }
    }
  }

  // Payments section header styling
  const payStart = 4 + teachers.length + 3
  const payHeader = ws[XLSX.utils.encode_cell({ r: payStart, c: 0 })]
  if (payHeader) {
    payHeader.s = { font: { bold: true, sz: 12 } }
  }
  const payColHeader = ws[XLSX.utils.encode_cell({ r: payStart + 1, c: 0 })]
  if (payColHeader) {
    for (let c = 0; c < 5; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: payStart + 1, c })]
      if (cell) cell.s = { font: { bold: true }, fill: { fgColor: { rgb: 'E2E8F0' } }, border, alignment: center }
    }
  }

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: dim + 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: dim + 1 } },
  ]
  ws['!freeze'] = { xSplit: 2, ySplit: 4 }
  ws['!pageSetup'] = {
    orientation: 'landscape',
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  }
  ws['!margins'] = { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 }
  ws['!printArea'] = `A1:${XLSX.utils.encode_cell({ r: payStart + 1 + payments.length, c: dim + 1 })}`
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
