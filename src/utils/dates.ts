export const MONTH_NAMES = [
  'Yanvar',
  'Fevral',
  'Mart',
  'Aprel',
  'May',
  'İyun',
  'İyul',
  'Avqust',
  'Sentyabr',
  'Oktyabr',
  'Noyabr',
  'Dekabr',
]

export function monthName(month: number): string {
  return MONTH_NAMES[Math.max(0, Math.min(11, month - 1))] ?? 'Ay'
}

export function monthLabel(year: number, month: number): string {
  return `${monthName(month)} ${year}`
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

export function dateKey(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`
}

export function formatDateAZ(dateStr: string): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return dateStr
  return `${pad2(d)} ${monthName(m)} ${y}`
}

export function nextMonth(year: number, month: number): { year: number; month: number } {
  const date = new Date(year, month, 1) // month is 1-based here; JS auto-rolls
  return { year: date.getFullYear(), month: date.getMonth() + 1 }
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d + days)
  return dateKey(dt.getFullYear(), dt.getMonth() + 1, dt.getDate())
}

export function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}
