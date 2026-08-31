export type PaymentStatus = 'DEFAULT' | 'UNPAID' | 'PAID'

export type CellType = 'course' | 'x'

export type CellValue = {
  value: string
  type: CellType
  courseInstanceId: string | null
}

export type Course = {
  id: string
  code: string
  name: string
  hours: number
  durationDays: number
  price?: number // undefined => auto/standard price; XS uses manual
  specialRule?: 'XS' | null
  active: boolean
}

export type Teacher = {
  id: string
  fullName: string
  order: number
  active: boolean
}

export type Month = {
  id: string // YYYY-MM
  year: number
  month: number // 1-12
  name: string // Azerbaijani name, e.g. "Sentyabr 2026"
  createdAt: number
}

export type CourseInstance = {
  id: string
  code: string
  monthId: string // anchor month (YYYY-MM) where it started
  teacherId: string
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  hours: number
  durationDays: number
  room: string | null
  location: 'Elmlər' | 'Ramana' | null
  paymentStatus: PaymentStatus
  price: number | null
  days: string[] // all dates (YYYY-MM-DD) across months
}

export type Colors = {
  default: string
  unpaid: string
  paid: string
}

export type Settings = {
  defaultCoursePrice: number
  colors: Colors
}

export type Room = {
  id: string
  name: string
}

export type PaymentRow = {
  teacherId: string
  courseCount: number
  totalHours: number
  totalAmount: number
  hasUnpaid: boolean
  hasPaid: boolean
}
