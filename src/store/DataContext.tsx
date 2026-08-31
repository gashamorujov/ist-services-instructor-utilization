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
  type WriteEntry,
} from '../services/courseService'
import { dateKey, nextMonth } from '../utils/dates'
import { genId } from '../utils/id'
import { INITIAL_COURSES, INITIAL_ROOMS, INITIAL_TEACHERS } from '../utils/seed'
import type {
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
  deleteInstance: (instanceId: string) => Promise<void>
  deleteInstanceDay: (instanceId: string, date: string) => Promise<void>
  updateInstance: (instanceId: string, patch: Partial<CourseInstance>) => Promise<void>
  addMonth: () => Promise<Month>
  deleteMonth: (monthId: string) => Promise<void>
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
  })
  const [activeMonthId, setActiveMonthIdState] = useState<string | null>(null)
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: 'success' | 'error' }[]>([])
  const [online, setOnline] = useState(true)
  const stateRef = useRef(state)
  stateRef.current = state
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

  // ---- Undo / Redo history ----
  const [historyTick, setHistoryTick] = useState(0)
  const undoStackRef = useRef<{ label: string; before: Map<string, unknown>; after: Map<string, unknown> }[]>([])
  const redoStackRef = useRef<{ label: string; before: Map<string, unknown>; after: Map<string, unknown> }[]>([])

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
      undoStackRef.current = [{ label, before, after }, ...undoStackRef.current].slice(0, 50)
      redoStackRef.current = []
      setHistoryTick((t) => t + 1)
    },
    [],
  )

  const performWrite = useCallback(
    async (writes: WriteEntry[], label: string) => {
      if (writes.length === 0) return
      const paths = writes.map((w) => w.path)
      await recordHistory(label, paths, () => applyWrites(writes))
    },
    [recordHistory],
  )

  const undo = useCallback(async () => {
    const action = undoStackRef.current[0]
    if (!action) return
    undoStackRef.current = undoStackRef.current.slice(1)
    redoStackRef.current = [{ label: action.label, before: action.before, after: action.after }, ...redoStackRef.current].slice(0, 50)
    const payload: Record<string, unknown> = {}
    action.before.forEach((v, p) => {
      payload[p] = v
    })
    await update(ref(db), payload)
    setHistoryTick((t) => t + 1)
  }, [])

  const redo = useCallback(async () => {
    const action = redoStackRef.current[0]
    if (!action) return
    redoStackRef.current = redoStackRef.current.slice(1)
    undoStackRef.current = [{ label: action.label, before: action.before, after: action.after }, ...undoStackRef.current].slice(0, 50)
    const payload: Record<string, unknown> = {}
    action.after.forEach((v, p) => {
      payload[p] = v
    })
    await update(ref(db), payload)
    setHistoryTick((t) => t + 1)
  }, [])

  // Base subscriptions
  useEffect(() => {
    const unsubs: (() => void)[] = []
    unsubs.push(subscribe<Record<string, Course>>('courses', (courses) => setState((s) => ({ ...s, courses: courses ?? {} }))))
    unsubs.push(subscribe<Record<string, Teacher>>('teachers', (teachers) => setState((s) => ({ ...s, teachers: teachers ?? {} }))))
    unsubs.push(subscribe<Record<string, Month>>('months', (months) => {
      const m = months ?? {}
      setState((s) => ({ ...s, months: m }))
      if (!activeRef.current) {
        const id = m['2026-09'] ? '2026-09' : Object.keys(m).sort()[0]
        if (id) {
          activeRef.current = id
          setActiveMonthIdState(id)
        }
      }
    }))
    unsubs.push(subscribe<Record<string, Room>>('rooms', (rooms) => setState((s) => ({ ...s, rooms: rooms ?? {} }))))
    unsubs.push(subscribe<Record<string, CourseInstance>>('courseInstances', (instances) => setState((s) => ({ ...s, courseInstances: instances ?? {} }))))
    unsubs.push(subscribe<Settings>('settings', (settings) => {
      if (settings) {
        setState((s) => ({
          ...s,
          settings: {
            defaultCoursePrice: settings.defaultCoursePrice ?? 70,
            colors: settings.colors ?? DEFAULT_SETTINGS.colors,
          },
          loading: false,
        }))
      } else {
        setState((s) => ({ ...s, loading: false, settings: DEFAULT_SETTINGS }))
      }
    }))
    return () => unsubs.forEach((u) => u())
  }, [])

  // Cells subscription bound to active month
  useEffect(() => {
    if (!activeMonthId) return
    const un = subscribe<Record<string, Record<string, CellValue>>>(`cells/${activeMonthId}`, (cells) => {
      const month = activeRef.current
      if (!month) return
      setState((s) => ({ ...s, cellsByMonth: { ...s.cellsByMonth, [month]: cells ?? {} } }))
    })
    return () => un()
  }, [activeMonthId])

  // Seed database once when the initial load completes and the DB is empty.
  const seedAttempted = useRef(false)
  useEffect(() => {
    if (seedAttempted.current || state.loading) return
    if (Object.keys(state.teachers).length === 0 && Object.keys(state.courses).length === 0) {
      seedAttempted.current = true
      seedDatabase(toast).catch(() => {
        seedAttempted.current = false
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.loading, state.teachers, state.courses])

  // online/offline
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => {
      setOnline(false)
      notifyError('İnternet əlaqəsi kəsildi. Məlumat sinxroniyası dayandırılıb.')
    }
    const onErr = () => notifyError('Məlumat yadda saxlanılarkən xəta baş verdi. Yenidən cəhd edin.')
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    window.addEventListener('firebase-error', onErr)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
      window.removeEventListener('firebase-error', onErr)
    }
  }, [notifyError])

  const buildLookup = useCallback((monthId: string) => {
    const s = stateRef.current
    const lookup = new Map<string, CellValue>()
    const addCells = (mId: string) => {
      const cells = s.cellsByMonth[mId] ?? {}
      for (const tid of Object.keys(cells)) {
        for (const dKey of Object.keys(cells[tid] ?? {})) {
          const c = cells[tid]?.[dKey]
          if (c) lookup.set(cellLookupKey(mId, tid, Number(dKey)), c)
        }
      }
    }
    addCells(monthId)
    const [y, m] = monthId.split('-').map(Number)
    const nm = nextMonth(y, m)
    const nextMonthId = `${nm.year}-${pad(nm.month)}`
    addCells(nextMonthId)
    return { lookup, nextMonthId }
  }, [])


  const removeDaysFromInstance = (instanceId: string, dates: string[], extraWrites: WriteEntry[] = []) => {
    const inst = stateRef.current.courseInstances[instanceId]
    if (!inst) return extraWrites
    const remaining = inst.days.filter((d) => !dates.includes(d))
    const writes = [...extraWrites]
    for (const date of dates) {
      const [yy, mm, dd] = date.split('-').map(Number)
      writes.push({ path: cellPath(`${yy}-${pad(mm)}`, inst.teacherId, dd), value: null })
    }
    if (remaining.length === 0) {
      writes.push({ path: `courseInstances/${instanceId}`, value: null })
    } else {
      writes.push({
        path: `courseInstances/${instanceId}`,
        value: { ...inst, days: remaining, startDate: remaining[0], endDate: remaining[remaining.length - 1] },
      })
    }
    return writes
  }

  const placeCourse = useCallback(
    async (monthId: string, teacherId: string, day: number, raw: string) => {
      const trimmed = raw.trim().toUpperCase()
      if (!trimmed) return
      const s = stateRef.current
      const [y, m] = monthId.split('-').map(Number)
      const dim = new Date(y, m, 0).getDate()
      if (day < 1 || day > dim) return

      // X code
      if (trimmed === 'X') {
        await performWrite([{ path: cellPath(monthId, teacherId, day), value: { value: 'X', type: 'x', courseInstanceId: null } }], 'X qeydi')
        toast('Qeyd edildi')
        return
      }

      // Avoid creating a duplicate when the cell already belongs to the same course+teacher.
      const currentCell = stateRef.current.cellsByMonth[monthId]?.[teacherId]?.[String(day)]
      if (currentCell?.value === trimmed && currentCell.courseInstanceId) {
        const curInst = stateRef.current.courseInstances[currentCell.courseInstanceId]
        if (curInst && curInst.teacherId === teacherId) {
          toast(`Bu xanada art\u0131q ${trimmed} qeyd olunub.`)
          return
        }
      }

      const course = Object.values(s.courses).find((c) => c.code.toUpperCase() === trimmed && c.active)
      if (!course && trimmed === 'XS') {
        // XS special course: single day, manual price required.
        const input = window.prompt('XS kursunun qiym\u0259tini daxil edin (AZN):', '')
        if (input === null) return
        const price = parseFloat(input)
        if (!Number.isFinite(price) || price < 0) {
          toast('D\u00fczg\u00fcn qiym\u0259t daxil edin.', 'error')
          return
        }
        const instanceId = newInstanceId()
        const date = dateKey(y, m, day)
        const inst: CourseInstance = {
          id: instanceId,
          code: 'XS',
          monthId,
          teacherId,
          startDate: date,
          endDate: date,
          hours: 8,
          durationDays: 1,
          room: null,
          location: null,
          paymentStatus: 'DEFAULT',
          price,
          days: [date],
        }
        await performWrite(
          [
            { path: `courseInstances/${instanceId}`, value: inst },
            { path: cellPath(monthId, teacherId, day), value: { value: 'XS', type: 'course', courseInstanceId: instanceId } },
          ],
          'XS kursu',
        )
        toast('XS kursu \u0259lav\u0259 edildi')
        return
      }
      if (!course) {
        toast('Bu kurs kodu sistemd\u0259 m\u00f6vcud deyil.', 'error')
        return
      }

      const { lookup, nextMonthId } = buildLookup(monthId)
      const willSpill = course.durationDays > dim - day + 1
      const nextId = willSpill && s.months[nextMonthId] ? nextMonthId : null
      if (nextId) {
        try {
          const snap = await get(ref(db, `cells/${nextId}`))
          const remote = snap.val() as Record<string, Record<string, CellValue>> | null
          if (remote) {
            for (const tid of Object.keys(remote)) {
              for (const dKey of Object.keys(remote[tid] ?? {})) {
                const c = remote[tid]?.[dKey]
                if (c) lookup.set(cellLookupKey(nextId, tid, Number(dKey)), c)
              }
            }
          }
        } catch {
          // offline / rules deny — continue with local copy
        }
      }

      const instanceId = newInstanceId()
      const isXS = course.specialRule === 'XS' || course.code === 'XS'
      const preserveKey = cellLookupKey(monthId, teacherId, day)
      const result = buildPlacement({
        month: { year: y, month: m },
        teacherId,
        startDay: day,
        code: course.code,
        course,
        instanceId,
        existingCells: lookup,
        nextMonthId: nextId,
        coursePrice: undefined,
        preserveKey,
      })

      if (!result.ok) {
        if (result.reason === 'invalid_code') {
          toast('Bu kurs kodu sistemdə mövcud deyil.', 'error')
        } else if (result.reason === 'beyond_month') {
          toast('Kurs ayın sonundan kənara daşınır. Əvvəlcə növbəti ayı yaradın.', 'error')
        } else {
          const ok = window.confirm(
            'Kursun davam etdiyi tarixlərdən bəziləri artıq məlumatla doldurulub. Davam etmək istəyirsiniz?',
          )
          if (!ok) return
          const overwriteResult = buildPlacement({
            month: { year: y, month: m },
            teacherId,
            startDay: day,
            code: course.code,
            course,
            instanceId,
            existingCells: new Map(),
            nextMonthId: nextId,
            coursePrice: undefined,
            preserveKey,
          })
          if (overwriteResult.ok) {
            // Clean up the days we are about to overwrite from their old instances
            // so orphaned instances do not keep being counted in payments.
            const extra = new Map<string, string[]>()
            const clobberedDates = new Set<string>()
            for (const ck of overwriteResult.cells) {
              const key = cellLookupKey(ck.monthId, ck.teacherId, ck.day)
              const prevInstId = lookup.get(key)?.courseInstanceId
              const prevInst = prevInstId ? stateRef.current.courseInstances[prevInstId] : undefined
              if (prevInst) {
                const [yy, mm] = ck.monthId.split('-').map(Number)
                const date = dateKey(yy, mm, ck.day)
                if (!clobberedDates.has(date)) {
                  clobberedDates.add(date)
                  const list = extra.get(prevInst.id) ?? []
                  list.push(date)
                  extra.set(prevInst.id, list)
                }
              }
            }
            let cleanupWrites: WriteEntry[] = []
            for (const [instId, dates] of extra) {
              cleanupWrites = removeDaysFromInstance(instId, dates, cleanupWrites)
            }
            await performWrite([...overwriteResult.writes, ...cleanupWrites], 'Kurs əlavə edildi (üstə yazıldı)')
            toast('Kurs əlavə edildi')
          } else {
            const inst: CourseInstance = {
              id: instanceId,
              code: course.code,
              monthId,
              teacherId,
              startDate: dateKey(y, m, day),
              endDate: dateKey(y, m, day),
              hours: course.hours,
              durationDays: 1,
              room: null,
              location: null,
              paymentStatus: 'DEFAULT',
              price: null,
              days: [dateKey(y, m, day)],
            }
            const curInstId = stateRef.current.cellsByMonth[monthId]?.[teacherId]?.[String(day)]?.courseInstanceId
            const prevInst = curInstId ? stateRef.current.courseInstances[curInstId] : undefined
            let writes: WriteEntry[] = [
              { path: `courseInstances/${instanceId}`, value: inst },
              { path: cellPath(monthId, teacherId, day), value: { value: course.code, type: 'course', courseInstanceId: instanceId } },
            ]
            if (prevInst) writes = removeDaysFromInstance(prevInst.id, [dateKey(y, m, day)], writes)
            await performWrite(writes, 'Kurs əlavə edildi')
            toast('Kurs əlavə edildi')
          }
        }
        return
      }

      if (isXS) {
        const input = window.prompt('XS kursunun qiymətini daxil edin (AZN):', '')
        if (input === null) return
        const price = parseFloat(input)
        if (!Number.isFinite(price) || price < 0) {
          toast('Düzgün qiymət daxil edin.', 'error')
          return
        }
        const writes = result.writes.map((w) => ({ ...w }))
        const idx = writes.findIndex((w) => w.path === `courseInstances/${instanceId}`)
        if (idx >= 0) {
          const inst = writes[idx]!.value as CourseInstance
          writes[idx] = { ...writes[idx]!, value: { ...inst, price } }
        }
        await performWrite(writes, 'Kurs əlavə edildi')
        toast('Kurs əlavə edildi')
        return
      }

      await performWrite(result.writes, 'Kurs əlavə edildi')
      toast('Kurs əlavə edildi')
    },
    [toast, buildLookup],
  )

  const setCellX = useCallback(
    async (monthId: string, teacherId: string, day: number) => {
      await performWrite([{ path: cellPath(monthId, teacherId, day), value: { value: 'X', type: 'x', courseInstanceId: null } }], 'X qeydi')
      toast('Qeyd edildi')
    },
    [toast],
  )

  const clearCell = useCallback(async (monthId: string, teacherId: string, day: number) => {
    await performWrite([{ path: cellPath(monthId, teacherId, day), value: null }], 'Xananı təmizlə')
  }, [performWrite])

  const deleteInstance = useCallback(
    async (instanceId: string) => {
      const s = stateRef.current
      const inst = s.courseInstances[instanceId]
      if (!inst) return
      const writes: WriteEntry[] = []
      for (const date of inst.days) {
        const [yy, mm, dd] = date.split('-').map(Number)
        writes.push({ path: cellPath(`${yy}-${pad(mm)}`, inst.teacherId, dd), value: null })
      }
      writes.push({ path: `courseInstances/${instanceId}`, value: null })
      await performWrite(writes, 'Kurs silindi')
      toast('Kurs silindi')
    },
    [toast],
  )

  const deleteInstanceDay = useCallback(
    async (instanceId: string, date: string) => {
      const inst = stateRef.current.courseInstances[instanceId]
      if (!inst) return
      await performWrite(removeDaysFromInstance(instanceId, [date]), 'Gün silindi')
    },
    [removeDaysFromInstance, performWrite],
  )

  const updateInstance = useCallback(async (instanceId: string, patch: Partial<CourseInstance>) => {
    const inst = stateRef.current.courseInstances[instanceId]
    if (!inst) return
    await performWrite([{ path: `courseInstances/${instanceId}`, value: { ...inst, ...patch } }], 'Kurs məlumatı yeniləndi')
  }, [performWrite])

  const addMonth = useCallback(async (): Promise<Month> => {
    const s = stateRef.current
    const ids = Object.keys(s.months).sort()
    const lastId = ids[ids.length - 1] ?? '2026-08'
    const [lastY, lastM] = lastId.split('-').map(Number)
    const nm = nextMonth(lastY, lastM)
    const id = `${nm.year}-${pad(nm.month)}`
    if (s.months[id]) {
      toast('Bu ay artıq mövcuddur.')
      return s.months[id]!
    }
    const month: Month = { id, year: nm.year, month: nm.month, name: `${monthName(nm.month)} ${nm.year}`, createdAt: Date.now() }
    await set(ref(db, `months/${id}`), month)
    setActiveMonthId(id)
    toast('Ay yaradıldı')
    return month
  }, [toast, setActiveMonthId])

  const deleteMonth = useCallback(
    async (monthId: string) => {
      const s = stateRef.current
      await remove(ref(db, `months/${monthId}`))
      await remove(ref(db, `cells/${monthId}`))
      const payload: Record<string, unknown> = {}
      for (const id of Object.keys(s.courseInstances)) {
        const inst = s.courseInstances[id]
        if (inst?.monthId === monthId) payload[`courseInstances/${id}`] = null
      }
      if (Object.keys(payload).length) await update(ref(db), payload)
      if (activeRef.current === monthId) {
        const rest = Object.keys(stateRef.current.months).filter((k) => k !== monthId).sort()
        const next = rest[0] ?? null
        if (next) setActiveMonthId(next)
      }
      toast('Ay silindi')
    },
    [toast, setActiveMonthId],
  )

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
      deleteInstance,
      deleteInstanceDay,
      updateInstance,
      addMonth,
      deleteMonth,
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
      toast,
      notifyError,
      online,
      canUndo: undoStackRef.current.length > 0,
      canRedo: redoStackRef.current.length > 0,
      undo,
      redo,
    }),
    [
      state, activeMonthId, setActiveMonthId, placeCourse, setCellX, clearCell,
      deleteInstance, deleteInstanceDay, updateInstance, addMonth, deleteMonth,
      addTeacher, updateTeacher, deleteTeacher, addCourse, updateCourse, deleteCourse,
      addRoom, updateRoom, deleteRoom, updateSettings, toast, notifyError, online,
      undo, redo, historyTick,
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

async function seedDatabase(toast: (msg: string, type?: 'success' | 'error') => void) {
  const payload: Record<string, unknown> = {}
  for (const t of INITIAL_TEACHERS) payload[`teachers/${t.id}`] = t
  for (const c of INITIAL_COURSES) payload[`courses/${c.id}`] = { ...c, price: c.price ?? null }
  for (const r of INITIAL_ROOMS) payload[`rooms/r_${r.replace(/\//g, '_')}`] = { id: `r_${r.replace(/\//g, '_')}`, name: r }
  payload['settings'] = DEFAULT_SETTINGS
  payload['months/2026-09'] = { id: '2026-09', year: 2026, month: 9, name: 'Sentyabr 2026', createdAt: Date.now() }
  await update(ref(db), payload)
  toast('İlkin məlumatlar yaradıldı')
}
