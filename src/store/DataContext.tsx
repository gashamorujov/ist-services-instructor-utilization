import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { get, ref, remove, set, update } from 'firebase/database'
import { db } from '../services/firebase'
import { subscribe } from '../services/firestoreService'
import {
  applyWrites,
  buildPlacement,
  cellLookupKey,
  cellPath,
  newInstanceId,
} from '../services/courseService'
import { nextMonth } from '../utils/dates'
import { genId } from '../utils/id'
import type {
  ArchivedYear,
  CellValue,
  Course,
  CourseInstance,
  Month,
  Room,
  Settings,
  Teacher,
} from '../types'

type DataState = {
  loading: boolean
  settings: Settings
  teachers: Record<string, Teacher>
  courses: Record<string, Course>
  months: Record<string, Month>
  rooms: Record<string, Room>
  courseInstances: Record<string, CourseInstance>
  cellsByMonth: Record<string, Record<string, Record<string, CellValue>>>
  archives: Record<string, ArchivedYear>
}

const DEFAULT_SETTINGS: Settings = {
  defaultCoursePrice: 70,
  colors: { default: '#000000', unpaid: '#FF0000', paid: '#008000' },
}

type DataContextValue = DataState & {
  activeMonthId: string | null
  setActiveMonthId: (id: string) => void
  placeCourse: (monthId: string, teacherId: string, day: number, raw: string) => Promise<void>
  setCellX: (monthId: string, teacherId: string, day: number) => Promise<void>
  clearCell: (monthId: string, teacherId: string, day: number) => Promise<void>
  updateCellLocation: (monthId: string, teacherId: string, day: number, location: 'Elmlər' | 'Ramana' | null) => Promise<void>
  deleteInstance: (instanceId: string) => Promise<void>
  deleteInstanceDay: (instanceId: string, date: string) => Promise<void>
  updateInstance: (instanceId: string, patch: Partial<CourseInstance>) => Promise<void>
  addMonth: () => Promise<Month>
  addMonthById: (year: number, month: number) => Promise<Month | null>
  deleteMonth: (monthId: string) => Promise<void>
  trashMonth: (monthId: string) => Promise<void>
  restoreMonth: (monthId: string) => Promise<void>
  permanentDeleteMonth: (monthId: string) => Promise<void>
  purgeExpiredTrash: () => Promise<void>
  addTeacher: (fullName: string) => Promise<void>
  updateTeacher: (id: string, patch: Partial<Teacher>) => Promise<void>
  deleteTeacher: (id: string) => Promise<void>
  addCourse: (data: Omit<Course, 'id'>) => Promise<void>
  updateCourse: (id: string, patch: Partial<Course>) => Promise<void>
  deleteCourse: (id: string) => Promise<void>
  addRoom: (name: string) => Promise<void>
  updateRoom: (id: string, name: string) => Promise<void>
  deleteRoom: (id: string) => Promise<void>
  updateSettings: (patch: Partial<Settings>) => Promise<void>
  deleteTeacherPayments: (teacherId: string, monthId: string) => Promise<void>
  addArchive: (year: number, months: Record<string, Month>) => Promise<void>
  deleteArchive: (archiveId: string) => Promise<void>
  toast: (msg: string, type?: 'success' | 'error') => void
  notifyError: (msg: string) => void
  online: boolean
  canUndo: boolean
  canRedo: boolean
  undo: () => Promise<void>
  redo: () => Promise<void>
}

const DataContext = createContext<DataContextValue | null>(null)

export function useData(): DataContextValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}

const MONTH_NAMES = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun',
  'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr',
]

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

function monthName(m: number): string {
  return MONTH_NAMES[Math.max(0, Math.min(11, m - 1))] ?? 'Ay'
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DataState>({
    loading: true,
    settings: DEFAULT_SETTINGS,
    teachers: {},
    courses: {},
    months: {},
    rooms: {},
    courseInstances: {},
    cellsByMonth: {},
    archives: {},
  })
  const [activeMonthId, setActiveMonthIdState] = useState<string | null>(null)
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: 'success' | 'error' }[]>([])
  const [online, setOnline] = useState(true)
  const stateRef = useRef(state)
  const activeRef = useRef<string | null>(null)

  const toast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, msg, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }, [])

  const notifyError = useCallback((msg: string) => toast(msg, 'error'), [toast])

  const setActiveMonthId = useCallback((id: string) => {
    activeRef.current = id
    setActiveMonthIdState(id)
  }, [])

  // Sync stateRef after render
  useEffect(() => {
    stateRef.current = state
  }, [state])

  // ---- Undo / Redo history ----
  const [historyTick, setHistoryTick] = useState(0)
  const [canUndoState, setCanUndoState] = useState(false)
  const [canRedoState, setCanRedoState] = useState(false)
  const undoStackRef = useRef<{ label: string; before: Map<string, unknown>; after: Map<string, unknown> }[]>([])
  const redoStackRef = useRef<{ label: string; before: Map<string, unknown>; after: Map<string, unknown> }[]>([])

  // Sync canUndo/canRedo state from refs whenever history changes
  useEffect(() => {
    setCanUndoState(undoStackRef.current.length > 0)
    setCanRedoState(redoStackRef.current.length > 0)
  }, [historyTick])

  const recordHistory = useCallback(
    async (label: string, paths: string[], run: () => Promise<void>) => {
      const read = async (p: string): Promise<unknown> => {
        try {
          const snap = await get(ref(db, p))
          return snap.val() ?? null
        } catch {
          return undefined
        }
      }
      const before = new Map<string, unknown>()
      for (const p of paths) before.set(p, await read(p))
      await run()
      const after = new Map<string, unknown>()
      for (const p of paths) after.set(p, await read(p))
      undoStackRef.current.push({ label, before, after })
      if (undoStackRef.current.length > 50) undoStackRef.current.shift()
      redoStackRef.current = []
      setHistoryTick((t) => t + 1)
    },
    [],
  )

  const undo = useCallback(async () => {
    const entry = undoStackRef.current.pop()
    if (!entry) return
    const payload: Record<string, unknown> = {}
    for (const [p, v] of entry.before) payload[p] = v ?? null
    await update(ref(db), payload)
    redoStackRef.current.push(entry)
    setHistoryTick((t) => t + 1)
    toast('Geri qaytarıldı')
  }, [toast])

  const redo = useCallback(async () => {
    const entry = redoStackRef.current.pop()
    if (!entry) return
    const payload: Record<string, unknown> = {}
    for (const [p, v] of entry.after) payload[p] = v ?? null
    await update(ref(db), payload)
    undoStackRef.current.push(entry)
    setHistoryTick((t) => t + 1)
    toast('İrəli aparıldı')
  }, [toast])

  // ---- Firebase subscriptions ----
  useEffect(() => {
    const unsubs: (() => void)[] = []
    unsubs.push(subscribe<Record<string, Teacher>>('teachers', (d) => {
      setState((s) => ({ ...s, teachers: d ?? {} }))
    }))
    unsubs.push(subscribe<Record<string, Course>>('courses', (d) => {
      setState((s) => ({ ...s, courses: d ?? {} }))
    }))
    unsubs.push(subscribe<Record<string, Month>>('months', (d) => {
      setState((s) => {
        const months = d ?? {}
        // Auto-select first active (non-trashed) month
        const active = Object.values(months).filter((m) => !m.deletedAt).sort((a, b) => a.id.localeCompare(b.id))
        const activeId = active[0]?.id ?? null
        if (!activeRef.current || !months[activeRef.current] || months[activeRef.current].deletedAt) {
          if (activeId) {
            activeRef.current = activeId
            setActiveMonthIdState(activeId)
          }
        }
        return { ...s, months, loading: false }
      })
    }))
    unsubs.push(subscribe<Record<string, Room>>('rooms', (d) => {
      setState((s) => ({ ...s, rooms: d ?? {} }))
    }))
    unsubs.push(subscribe<Record<string, CourseInstance>>('courseInstances', (d) => {
      setState((s) => ({ ...s, courseInstances: d ?? {} }))
    }))
    unsubs.push(subscribe<Record<string, Record<string, Record<string, CellValue>>>>('cells', (d) => {
      setState((s) => ({ ...s, cellsByMonth: d ?? {} }))
    }))
    unsubs.push(subscribe<Settings>('settings', (d) => {
      setState((s) => ({ ...s, settings: d ?? DEFAULT_SETTINGS }))
    }))
    unsubs.push(subscribe<Record<string, ArchivedYear>>('archives', (d) => {
      setState((s) => ({ ...s, archives: d ?? {} }))
    }))

    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    window.addEventListener('firebase-error', () => {
      notifyError('Firebase bağlantısı kəsildi')
    })

    return () => {
      unsubs.forEach((u) => u())
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [notifyError])

  const permanentDeleteMonthInternal = useCallback(async (monthId: string) => {
    await remove(ref(db, `months/${monthId}`))
    await remove(ref(db, `cells/${monthId}`))
    const payload: Record<string, unknown> = {}
    for (const id of Object.keys(stateRef.current.courseInstances)) {
      const inst = stateRef.current.courseInstances[id]
      if (inst?.monthId === monthId) payload[`courseInstances/${id}`] = null
    }
    if (Object.keys(payload).length) await update(ref(db), payload)
    if (activeRef.current === monthId) {
      const rest = Object.keys(stateRef.current.months)
        .filter((k) => k !== monthId && !stateRef.current.months[k]?.deletedAt)
        .sort()
      const next = rest[0] ?? null
      if (next) setActiveMonthId(next)
    }
  }, [setActiveMonthId])

  // ---- Auto-purge expired trash (24 hours) ----
  useEffect(() => {
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000
    const purge = async () => {
      const now = Date.now()
      const months = stateRef.current.months
      for (const m of Object.values(months)) {
        if (m.deletedAt && now - m.deletedAt >= TWENTY_FOUR_HOURS) {
          await permanentDeleteMonthInternal(m.id)
        }
      }
    }
    purge()
    const interval = setInterval(purge, 60 * 1000) // check every minute
    return () => clearInterval(interval)
  }, [permanentDeleteMonthInternal])

  // ---- Month helpers ----
  const addMonth = useCallback(async (): Promise<Month> => {
    const s = stateRef.current
    const existing = Object.values(s.months).filter((m) => !m.deletedAt)
    let year = new Date().getFullYear()
    let month = new Date().getMonth() + 1
    if (existing.length > 0) {
      const sorted = existing.sort((a, b) => b.id.localeCompare(a.id))
      const last = sorted[0]!
      const nm = nextMonth(last.year, last.month)
      year = nm.year
      month = nm.month
    }
    const id = `${year}-${pad(month)}`
    // Check if already exists (active or trashed)
    if (s.months[id]) {
      toast('Bu ay artıq mövcuddur.', 'error')
      return s.months[id]!
    }
    const m: Month = { id, year, month, name: `${monthName(month)} ${year}`, createdAt: Date.now() }
    await set(ref(db, `months/${id}`), m)
    setActiveMonthId(id)
    toast(`${m.name} yaradıldı`)
    return m
  }, [toast, setActiveMonthId])

  const addMonthById = useCallback(async (year: number, month: number): Promise<Month | null> => {
    const s = stateRef.current
    const id = `${year}-${pad(month)}`
    if (s.months[id]) {
      toast('Bu ay artıq mövcuddur.', 'error')
      return null
    }
    const m: Month = { id, year, month, name: `${monthName(month)} ${year}`, createdAt: Date.now() }
    await set(ref(db, `months/${id}`), m)
    setActiveMonthId(id)
    toast(`${m.name} yaradıldı`)
    return m
  }, [toast, setActiveMonthId])


  const deleteMonth = useCallback(
    async (monthId: string) => {
      await recordHistory('Ay silindi', [`months/${monthId}`, `cells/${monthId}`], () =>
        permanentDeleteMonthInternal(monthId),
      )
      toast('Ay silindi')
    },
    [toast, recordHistory, permanentDeleteMonthInternal],
  )

  const trashMonth = useCallback(
    async (monthId: string) => {
      const s = stateRef.current
      const m = s.months[monthId]
      if (!m) return
      const patched: Month = { ...m, deletedAt: Date.now() }
      await recordHistory('Ay zibil qutusuna köçürüldü', [`months/${monthId}`], async () => {
        await set(ref(db, `months/${monthId}`), patched)
      })
      if (activeRef.current === monthId) {
        const rest = Object.values(s.months)
          .filter((x) => x.id !== monthId && !x.deletedAt)
          .sort((a, b) => a.id.localeCompare(b.id))
        if (rest[0]) setActiveMonthId(rest[0].id)
      }
      toast('Ay zibil qutusuna köçürüldü')
    },
    [toast, setActiveMonthId, recordHistory],
  )

  const restoreMonth = useCallback(
    async (monthId: string) => {
      const s = stateRef.current
      const m = s.months[monthId]
      if (!m) return
      const patched: Month = { ...m, deletedAt: undefined }
      await recordHistory('Ay bərpa edildi', [`months/${monthId}`], async () => {
        await set(ref(db, `months/${monthId}`), patched)
      })
      setActiveMonthId(monthId)
      toast('Ay bərpa edildi')
    },
    [toast, setActiveMonthId, recordHistory],
  )

  const permanentDeleteMonth = useCallback(
    async (monthId: string) => {
      await recordHistory('Ay həmişəlik silindi', [`months/${monthId}`, `cells/${monthId}`], () =>
        permanentDeleteMonthInternal(monthId),
      )
      toast('Ay həmişəlik silindi')
    },
    [toast, recordHistory, permanentDeleteMonthInternal],
  )

  const purgeExpiredTrash = useCallback(async () => {
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000
    const now = Date.now()
    const months = stateRef.current.months
    for (const m of Object.values(months)) {
      if (m.deletedAt && now - m.deletedAt >= TWENTY_FOUR_HOURS) {
        await permanentDeleteMonthInternal(m.id)
      }
    }
  }, [permanentDeleteMonthInternal])

  const deleteInstanceInternal = async (instanceId: string) => {
    const inst = stateRef.current.courseInstances[instanceId]
    if (!inst) return
    await remove(ref(db, `courseInstances/${instanceId}`))
    const payload: Record<string, unknown> = {}
    const monthCells = stateRef.current.cellsByMonth[inst.monthId] ?? {}
    const teacherCells = monthCells[inst.teacherId] ?? {}
    for (const [dayStr, cell] of Object.entries(teacherCells)) {
      if (cell.courseInstanceId === instanceId) {
        payload[cellPath(inst.monthId, inst.teacherId, Number(dayStr))] = null
      }
    }
    if (Object.keys(payload).length > 0) await update(ref(db), payload)
  }

  // ---- Place course (with next month support) ----
  const placeCourse = useCallback(
    async (monthId: string, teacherId: string, day: number, raw: string) => {
      if (!raw || raw.trim() === '') return
      const code = raw.trim().toUpperCase()
      const s = stateRef.current
      const courses = Object.values(s.courses)
      const course = courses.find((c) => c.code.toUpperCase() === code && c.active)
      if (!course) {
        toast(`Kurs kodu tapılmadı: ${code}`, 'error')
        return
      }
      const currentMonth = s.months[monthId]
      if (!currentMonth) return
      const nm = nextMonth(currentMonth.year, currentMonth.month)
      const nextMonthId = `${nm.year}-${pad(nm.month)}`
      const nextExists = !!s.months[nextMonthId] && !s.months[nextMonthId]?.deletedAt
      const monthCells = s.cellsByMonth[monthId] ?? {}
      const teacherCells = monthCells[teacherId] ?? {}
      const existingCells = new Map<string, CellValue>()
      for (const [dayStr, cell] of Object.entries(teacherCells)) {
        existingCells.set(cellLookupKey(monthId, teacherId, Number(dayStr)), cell)
      }
      const coursePrice = course.specialRule === 'XS' ? course.price : undefined
      const preserveCell = teacherCells[String(day)]
      const preserveKey = preserveCell?.courseInstanceId
        ? cellLookupKey(monthId, teacherId, day)
        : null
      const result = buildPlacement({
        month: currentMonth,
        teacherId,
        startDay: day,
        code: course.code,
        course,
        instanceId: newInstanceId(),
        existingCells,
        nextMonthId: nextExists ? nextMonthId : null,
        coursePrice,
        preserveKey,
      })
      if (!result.ok) {
        if (result.reason === 'occupied') {
          const occupiedDays = result.occupiedDays.map((k) => k.day).join(', ')
          toast(`Bu xanalar artıq doludur: ${occupiedDays}`, 'error')
        } else if (result.reason === 'beyond_month') {
          toast('Kurs bu ayın sonunu keçir. Növbəti ayı əlavə edin.', 'error')
        } else {
          toast('Yanlış kurs kodu', 'error')
        }
        return
      }
      // If this cell is part of an existing instance, delete the old instance first
      if (preserveCell?.courseInstanceId) {
        const oldInstId = preserveCell.courseInstanceId
        await deleteInstanceInternal(oldInstId)
      }
      await applyWrites(result.writes)
      toast(`${course.code} kursu əlavə edildi`)
    },
    [toast],
  )

  const setCellX = useCallback(
    async (monthId: string, teacherId: string, day: number) => {
      await set(ref(db, cellPath(monthId, teacherId, day)), { value: 'X', type: 'x', courseInstanceId: null })
    },
    [],
  )

  const clearCell = useCallback(
    async (monthId: string, teacherId: string, day: number) => {
      const s = stateRef.current
      const cell = s.cellsByMonth[monthId]?.[teacherId]?.[String(day)]
      if (cell?.courseInstanceId) {
        await deleteInstanceInternal(cell.courseInstanceId)
      } else {
        await remove(ref(db, cellPath(monthId, teacherId, day)))
      }
    },
    [],
  )

  const updateCellLocation = useCallback(
    async (monthId: string, teacherId: string, day: number, location: 'Elmlər' | 'Ramana' | null) => {
      const s = stateRef.current
      const cell = s.cellsByMonth[monthId]?.[teacherId]?.[String(day)]
      if (!cell) return
      await set(ref(db, cellPath(monthId, teacherId, day)), { ...cell, location })
    },
    [],
  )


  const deleteInstance = useCallback(
    async (instanceId: string) => {
      await recordHistory('Kurs silindi', [`courseInstances/${instanceId}`], () =>
        deleteInstanceInternal(instanceId),
      )
      toast('Kurs silindi')
    },
    [toast, recordHistory],
  )

  const deleteInstanceDay = useCallback(
    async (instanceId: string, date: string) => {
      const s = stateRef.current
      const inst = s.courseInstances[instanceId]
      if (!inst) return
      const dayNum = Number(date.split('-')[2])
      await remove(ref(db, cellPath(inst.monthId, inst.teacherId, dayNum)))
      const newDays = inst.days.filter((d) => d !== date)
      if (newDays.length === 0) {
        await deleteInstanceInternal(instanceId)
      } else {
        const monthId = `${date.split('-')[0]}-${date.split('-')[1]}`
        await set(ref(db, `courseInstances/${instanceId}/days`), newDays)
        await set(ref(db, `courseInstances/${instanceId}/startDate`), newDays[0])
        await set(ref(db, `courseInstances/${instanceId}/endDate`), newDays[newDays.length - 1])
        await set(ref(db, `courseInstances/${instanceId}/monthId`), monthId)
        await set(ref(db, `courseInstances/${instanceId}/durationDays`), newDays.length)
      }
      toast('Gün silindi')
    },
    [toast],
  )

  const updateInstance = useCallback(async (instanceId: string, patch: Partial<CourseInstance>) => {
    const cur = stateRef.current.courseInstances[instanceId]
    if (!cur) return
    await set(ref(db, `courseInstances/${instanceId}`), { ...cur, ...patch })
  }, [])

  // ---- Teacher payments deletion ----
  const deleteTeacherPayments = useCallback(
    async (teacherId: string, monthId: string) => {
      const s = stateRef.current
      const paths: string[] = []
      const courseInstancesToRemove: string[] = []
      for (const [id, inst] of Object.entries(s.courseInstances)) {
        if (inst.teacherId === teacherId && inst.monthId === monthId) {
          paths.push(`courseInstances/${id}`)
          courseInstancesToRemove.push(id)
        }
      }
      const monthCells = s.cellsByMonth[monthId] ?? {}
      const teacherCells = monthCells[teacherId] ?? {}
      for (const [dayStr, cell] of Object.entries(teacherCells)) {
        if (cell.courseInstanceId && courseInstancesToRemove.includes(cell.courseInstanceId)) {
          paths.push(cellPath(monthId, teacherId, Number(dayStr)))
        }
      }
      if (paths.length === 0) {
        toast('Bu müəllim üçün ödəniş tapılmadı', 'error')
        return
      }
      await recordHistory('Müəllim ödənişi silindi', paths, async () => {
        const payload: Record<string, unknown> = {}
        for (const p of paths) payload[p] = null
        await update(ref(db), payload)
      })
      toast('Müəllim ödənişi silindi')
    },
    [toast, recordHistory],
  )

  // ---- Archive ----
  const addArchive = useCallback(
    async (year: number, activeMonths: Record<string, Month>) => {
      const endYear = year + 1
      const archiveId = `${year}-${endYear}`
      const archivedMonths: Record<string, Month> = {}
      for (const [id, m] of Object.entries(activeMonths)) {
        if (m.year === year || m.year === endYear) archivedMonths[id] = m
      }
      const archivedInstances: Record<string, CourseInstance> = {}
      for (const [id, inst] of Object.entries(stateRef.current.courseInstances)) {
        if (archivedMonths[inst.monthId]) archivedInstances[id] = inst
      }
      const archivedCells: Record<string, Record<string, Record<string, CellValue>>> = {}
      for (const monthId of Object.keys(archivedMonths)) {
        if (stateRef.current.cellsByMonth[monthId]) archivedCells[monthId] = stateRef.current.cellsByMonth[monthId]
      }
      const archive: ArchivedYear = {
        id: archiveId,
        name: `${year}-${endYear} tədris ili`,
        archivedAt: Date.now(),
        startYear: year,
        endYear,
        months: archivedMonths,
        teachers: stateRef.current.teachers,
        courses: stateRef.current.courses,
        courseInstances: archivedInstances,
        cellsByMonth: archivedCells,
        settings: stateRef.current.settings,
      }
      await set(ref(db, `archives/${archiveId}`), archive)
      // Remove archived months from active
      const payload: Record<string, unknown> = {}
      for (const monthId of Object.keys(archivedMonths)) {
        payload[`months/${monthId}`] = null
        payload[`cells/${monthId}`] = null
      }
      for (const id of Object.keys(archivedInstances)) {
        payload[`courseInstances/${id}`] = null
      }
      await update(ref(db), payload)
      toast(`${year}-${endYear} ili arxivləşdirildi`)
    },
    [toast],
  )

  const deleteArchive = useCallback(
    async (archiveId: string) => {
      await remove(ref(db, `archives/${archiveId}`))
      toast('Arxiv silindi')
    },
    [toast],
  )

  // ---- Teacher management ----
  const addTeacher = useCallback(
    async (fullName: string) => {
      const id = genId('t')
      const order = Object.keys(stateRef.current.teachers).length + 1
      await set(ref(db, `teachers/${id}`), { id, fullName, order, active: true })
      toast('Müəllim əlavə edildi')
    },
    [toast],
  )
  const updateTeacher = useCallback(async (id: string, patch: Partial<Teacher>) => {
    const cur = stateRef.current.teachers[id]
    if (!cur) return
    await set(ref(db, `teachers/${id}`), { ...cur, ...patch })
  }, [])
  const deleteTeacher = useCallback(async (id: string) => {
    await remove(ref(db, `teachers/${id}`))
    toast('Müəllim silindi')
  }, [toast])

  // ---- Course management ----
  const addCourse = useCallback(
    async (data: Omit<Course, 'id'>) => {
      const id = genId('c')
      await set(ref(db, `courses/${id}`), { ...data, price: data.price ?? null, id })
      toast('Kurs əlavə edildi')
    },
    [toast],
  )
  const updateCourse = useCallback(async (id: string, patch: Partial<Course>) => {
    const cur = stateRef.current.courses[id]
    if (!cur) return
    await set(ref(db, `courses/${id}`), { ...cur, ...patch })
  }, [])
  const deleteCourse = useCallback(async (id: string) => {
    await remove(ref(db, `courses/${id}`))
    toast('Kurs silindi')
  }, [toast])

  // ---- Room management ----
  const addRoom = useCallback(
    async (name: string) => {
      const id = genId('r')
      await set(ref(db, `rooms/${id}`), { id, name })
      toast('Otaq əlavə edildi')
    },
    [toast],
  )
  const updateRoom = useCallback(async (id: string, name: string) => {
    await set(ref(db, `rooms/${id}`), { id, name })
  }, [])
  const deleteRoom = useCallback(async (id: string) => {
    await remove(ref(db, `rooms/${id}`))
    toast('Otaq silindi')
  }, [toast])

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    const cur = stateRef.current.settings
    await set(ref(db, 'settings'), { ...cur, ...patch })
  }, [])

  const value = useMemo<DataContextValue>(
    () => ({
      ...state,
      activeMonthId,
      setActiveMonthId,
      placeCourse,
      setCellX,
      clearCell,
      updateCellLocation,
      deleteInstance,
      deleteInstanceDay,
      updateInstance,
      addMonth,
      addMonthById,
      deleteMonth,
      trashMonth,
      restoreMonth,
      permanentDeleteMonth,
      purgeExpiredTrash,
      addTeacher,
      updateTeacher,
      deleteTeacher,
      addCourse,
      updateCourse,
      deleteCourse,
      addRoom,
      updateRoom,
      deleteRoom,
      updateSettings,
      deleteTeacherPayments,
      addArchive,
      deleteArchive,
      toast,
      notifyError,
      online,
      canUndo: canUndoState,
      canRedo: canRedoState,
      undo,
      redo,
    }),
    [
      state, activeMonthId, setActiveMonthId, placeCourse, setCellX, clearCell, updateCellLocation,
      deleteInstance, deleteInstanceDay, updateInstance, addMonth, addMonthById, deleteMonth,
      trashMonth, restoreMonth, permanentDeleteMonth, purgeExpiredTrash,
      addTeacher, updateTeacher, deleteTeacher, addCourse, updateCourse, deleteCourse,
      addRoom, updateRoom, deleteRoom, updateSettings,
      deleteTeacherPayments, addArchive, deleteArchive,
      toast, notifyError, online, canUndoState, canRedoState,
      undo, redo,
    ],
  )

  return (
    <DataContext.Provider value={value}>
      {children}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`toast-in rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${
                t.type === 'error' ? 'bg-red-600' : 'bg-slate-800'
              }`}
            >
              {t.msg}
            </div>
          ))}
        </div>
      )}
    </DataContext.Provider>
  )
}

