import { useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import { Download, DownloadCloud, Plus, Search, Trash2 } from 'lucide-react'
import { useData } from '../store/DataContext'
import { CoursePanel } from '../components/CoursePanel'
import { Badge, Button, ConfirmDialog, EmptyState } from '../components/ui'
import { computeActivePayments, paymentRowStatus, cellColor, cellTooltip } from '../utils/calc'
import { dateKey, formatDateAZ } from '../utils/dates'
import type { CellValue, Course, CourseInstance, Month, Settings } from '../types'

type Editing = {
  teacherId: string
  day: number
  value: string
}

export function SchedulePage() {
  const data = useData()
  const { activeMonthId, months, teachers, courses, courseInstances, cellsByMonth, settings } = data
  const currentMonth: Month | undefined = activeMonthId ? months[activeMonthId] : undefined
  const [selected, setSelected] = useState<{ teacherId: string; day: number } | null>(null)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [panelInstance, setPanelInstance] = useState<string | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; teacherId: string; day: number } | null>(null)
  const [teacherSearch, setTeacherSearch] = useState('')
  const [courseSearch, setCourseSearch] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<Month | null>(null)
  const longPressTimer = useRef<number | null>(null)

  const monthCells = currentMonth ? cellsByMonth[currentMonth.id] ?? {} : {}
  const activeTeachers = useMemo(
    () => Object.values(teachers).filter((t) => t.active).sort((a, b) => a.order - b.order),
    [teachers],
  )
  const dim = currentMonth ? new Date(currentMonth.year, currentMonth.month, 0).getDate() : 0

  // Instances that START in this month (counted exactly once for payments).
  const monthInstances = useMemo(() => {
    if (!currentMonth) return []
    return Object.values(courseInstances).filter((inst) => inst.monthId === currentMonth.id)
  }, [courseInstances, currentMonth])

  const payments = useMemo(
    () => computeActivePayments(monthInstances, activeTeachers, settings),
    [monthInstances, activeTeachers, settings],
  )

  const beginEdit = (teacherId: string, day: number, initial: string) => {
    setEditing({ teacherId, day, value: initial === 'X' ? '' : initial })
    setSelected({ teacherId, day })
    setCtxMenu(null)
  }

  const commitEdit = async () => {
    if (!editing || !currentMonth) return
    await data.placeCourse(currentMonth.id, editing.teacherId, editing.day, editing.value)
    setEditing(null)
  }

  const handleEditKeyDown = (e: KeyboardEvent) => {
    if (!editing) return
    if (e.key === 'Enter') {
      e.preventDefault()
      void commitEdit()
    } else if (e.key === 'Escape') {
      setEditing(null)
    }
  }

  const handleCellKeyDown = async (e: KeyboardEvent, teacherId: string, day: number) => {
    if (editing) return
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault()
      await data.clearCell(currentMonth!.id, teacherId, day)
      setSelected(null)
    } else if (e.key.length === 1 && /^[a-zA-Z0-9]$/.test(e.key)) {
      e.preventDefault()
      beginEdit(teacherId, day, e.key)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      beginEdit(teacherId, day, '')
    }
  }

  const handleDoubleClick = (teacherId: string, day: number) => {
    const cell = monthCells[teacherId]?.[String(day)]
    if (cell?.courseInstanceId) {
      setPanelInstance(cell.courseInstanceId)
    } else {
      setEditing({ teacherId, day, value: cell?.value ? (cell.value === 'X' ? '' : cell.value) : '' })
    }
  }

  const handleRightClick = (e: MouseEvent, teacherId: string, day: number) => {
    e.preventDefault()
    const cell = monthCells[teacherId]?.[String(day)]
    if (cell?.courseInstanceId) {
      setCtxMenu({ x: e.clientX, y: e.clientY, teacherId, day })
    }
  }

  const handleContextDelete = async (all: boolean) => {
    if (!ctxMenu) return
    const cell = monthCells[ctxMenu.teacherId]?.[String(ctxMenu.day)]
    const instanceId = cell?.courseInstanceId
    if (!instanceId) return
    if (all) {
      const ok = window.confirm('Kursun bütün günlərini silmək istəyirsiniz?')
      if (ok) await data.deleteInstance(instanceId)
    } else {
      if (!currentMonth) return
      await data.deleteInstanceDay(instanceId, dateKey(currentMonth.year, currentMonth.month, ctxMenu.day))
    }
    setCtxMenu(null)
  }

  const handleLocation = async (loc: 'Elmlər' | 'Ramana') => {
    if (!ctxMenu) return
    const cell = monthCells[ctxMenu.teacherId]?.[String(ctxMenu.day)]
    const instanceId = cell?.courseInstanceId
    if (!instanceId) return
    await data.updateInstance(instanceId, { location: loc })
    setCtxMenu(null)
  }

  const startLongPress = (teacherId: string, day: number) => {
    cancelLongPress()
    longPressTimer.current = window.setTimeout(() => {
      const cell = monthCells[teacherId]?.[String(day)]
      if (cell?.courseInstanceId) setPanelInstance(cell.courseInstanceId)
    }, 550)
  }
  const cancelLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  const exportCurrent = () => {
    if (!currentMonth) return
    void import('../services/exportService').then(({ exportMonthToExcel }) =>
      exportMonthToExcel({
        month: currentMonth,
        teachers: activeTeachers,
        courses,
        cells: monthCells,
        instances: courseInstances,
        settings,
      }),
    )
  }

  const exportAll = () => {
    const all = Object.values(months).sort((a, b) => a.id.localeCompare(b.id))
    void import('../services/exportService').then(({ exportAllMonthsToExcel }) =>
      exportAllMonthsToExcel(
        all.map((m) => ({
          month: m,
          teachers: activeTeachers,
          courses,
          cells: cellsByMonth[m.id] ?? {},
          instances: courseInstances,
          settings,
        })),
      ),
    )
  }

  const filteredTeachers = useMemo(() => {
    return activeTeachers.filter((t) => {
      const name = t.fullName.toLowerCase()
      const courseHit = courseSearch
        ? Object.values(monthCells[t.id] ?? {}).some((c) => c.value?.toLowerCase().includes(courseSearch.toLowerCase()))
        : true
      return name.includes(teacherSearch.toLowerCase()) && courseHit
    })
  }, [activeTeachers, teacherSearch, courseSearch, monthCells])

  if (!currentMonth || data.loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-200" />
        ))}
      </div>
    )
  }

  const ctxCell = ctxMenu ? monthCells[ctxMenu.teacherId]?.[String(ctxMenu.day)] : undefined
  const ctxInstance = ctxCell?.courseInstanceId ? courseInstances[ctxCell.courseInstanceId] : undefined
  const ctxCourse = ctxInstance ? courses[ctxInstance.code] : undefined
  const isSLO = ctxCourse?.code === 'SL' || ctxCourse?.code === 'SO'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Tədris cədvəli</h1>
          <p className="text-sm text-slate-500">{currentMonth.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={exportCurrent} data-testid="export-month">
            <Download size={16} />
            Bu ayı Excel kimi yüklə
          </Button>
          <Button variant="secondary" onClick={exportAll} data-testid="export-all">
            <DownloadCloud size={16} />
            Bütün ayları Excel kimi yüklə
          </Button>
        </div>
      </div>

      {/* Month tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 slim-scroll">
        {Object.values(months)
          .sort((a, b) => a.id.localeCompare(b.id))
          .map((m) => (
            <button
              key={m.id}
              data-testid={`month-tab-${m.id}`}
              onClick={() => data.setActiveMonthId(m.id)}
              className={`whitespace-nowrap rounded-t-lg px-4 py-2 text-sm font-semibold ${
                m.id === currentMonth.id
                  ? 'border-b-2 border-brand-600 bg-white text-brand-700'
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
              }`}
            >
              {m.name}
            </button>
          ))}
        <button
          onClick={() => void data.addMonth()}
          className="flex items-center gap-1 whitespace-nowrap rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <Plus size={16} />
          Ay əlavə et
        </button>
        <button
          onClick={() => setConfirmDelete(currentMonth)}
          className="flex items-center gap-1 whitespace-nowrap rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-100"
        >
          <Trash2 size={16} />
          Bu ayı sil
        </button>
      </div>

      {/* Search */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={teacherSearch}
            onChange={(e) => setTeacherSearch(e.target.value)}
            placeholder="Müəllim axtar..."
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={courseSearch}
            onChange={(e) => setCourseSearch(e.target.value)}
            placeholder="Kurs kodu axtar (kursun xanaları vurğulanır)..."
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
      </div>

      {filteredTeachers.length === 0 ? (
        <EmptyState title="Məlumat tapılmadı" description="Axtarış meyarlarına uyğun müəllim tapılmadı." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-auto slim-scroll" style={{ maxHeight: '65vh' }}>
            <table className="border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-30 min-w-[52px] border-b border-r border-slate-200 bg-slate-100 px-2 py-2 text-xs font-bold text-slate-600">
                    S/S
                  </th>
                  <th
                    className="sticky left-[52px] z-30 min-w-[220px] border-b border-r border-slate-200 bg-slate-100 px-3 py-2 text-left text-xs font-bold text-slate-600"
                    style={{ boxShadow: '1px 0 0 #e2e8f0' }}
                  >
                    Full Name / S.A.A
                  </th>
                  {Array.from({ length: dim }, (_, i) => i + 1).map((day) => {
                    const date = dateKey(currentMonth.year, currentMonth.month, day)
                    return (
                      <th
                        key={day}
                        title={formatDateAZ(date)}
                        className="min-w-[52px] border-b border-r border-slate-200 bg-slate-100 px-1 py-2 text-center text-xs font-bold text-slate-600"
                      >
                        {day}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredTeachers.map((t) => {
                  const cells = monthCells[t.id] ?? {}
                  return (
                    <tr key={t.id} className="group">
                      <td className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-2 py-1 text-center text-xs text-slate-500">
                        {t.order}
                      </td>
                      <td
                        className="sticky left-[52px] z-10 border-b border-r border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-800"
                        style={{ boxShadow: '1px 0 0 #e2e8f0' }}
                      >
                        {t.fullName}
                      </td>
                      {Array.from({ length: dim }, (_, i) => i + 1).map((day) => {
                        const cell = cells[String(day)]
                        const instance = cell?.courseInstanceId ? courseInstances[cell.courseInstanceId] : undefined
                        const course = instance ? courses[instance.code] : undefined
                        return (
                          <Cell
                            key={day}
                            dataCell={`${t.id}-${day}`}
                            cell={cell}
                            teacherId={t.id}
                            day={day}
                            selected={selected?.teacherId === t.id && selected?.day === day}
                            editing={editing?.teacherId === t.id && editing?.day === day}
                            editValue={editing?.teacherId === t.id && editing?.day === day ? editing.value : ''}
                            highlighted={!!courseSearch && (cell?.value?.toLowerCase().includes(courseSearch.toLowerCase()) ?? false)}
                            instance={instance}
                            course={course}
                            settings={settings}
                            onSelect={(tid, d) => {
                              setSelected({ teacherId: tid, day: d })
                              setCtxMenu(null)
                            }}
                            onBeginEdit={beginEdit}
                            onDoubleClick={handleDoubleClick}
                            onRightClick={handleRightClick}
                            onLongPressStart={startLongPress}
                            onLongPressEnd={cancelLongPress}
                            onEditKeyDown={handleEditKeyDown}
                            onCellKeyDown={handleCellKeyDown}
                          />
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400">
        İpucu: Xanaya klikləyin və yazın. Enter — yadda saxla, Esc — ləğv et, Backspace/Delete — sil, iki klik — kurs
        paneli, sağ klik — əlavə seçimlər, uzun basma — kurs paneli.
      </p>

      {payments.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-bold text-slate-800">Müəllimlərin ödənişləri</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="active-payments">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-bold text-slate-600">
                  <th className="px-4 py-2">Müəllim</th>
                  <th className="px-4 py-2 text-center">Kurs sayı</th>
                  <th className="px-4 py-2 text-center">Ümumi saat</th>
                  <th className="px-4 py-2 text-right">Məbləğ (AZN)</th>
                  <th className="px-4 py-2 text-center">Ödəniş statusu</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => {
                  const st = paymentRowStatus(p)
                  return (
                    <tr key={p.teacherId} className="border-t border-slate-100">
                      <td className="px-4 py-2 font-medium text-slate-800">{teachers[p.teacherId]?.fullName}</td>
                      <td className="px-4 py-2 text-center text-slate-600">{p.courseCount}</td>
                      <td className="px-4 py-2 text-center text-slate-600">{p.totalHours}</td>
                      <td className="px-4 py-2 text-right font-semibold text-slate-800">{p.totalAmount} AZN</td>
                      <td className="px-4 py-2 text-center">
                        <Badge tone={st === 'PAID' ? 'green' : st === 'UNPAID' ? 'red' : st === 'MIXED' ? 'amber' : 'slate'}>
                          {paymentLabel(st)}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {panelInstance && <CoursePanel instanceId={panelInstance} onClose={() => setPanelInstance(null)} />}

      {ctxMenu && ctxCell?.courseInstanceId && (
        <div
          className="fixed z-50 w-52 rounded-lg border border-slate-200 bg-white p-1 shadow-xl"
          style={{ left: Math.min(ctxMenu.x, window.innerWidth - 220), top: Math.min(ctxMenu.y, window.innerHeight - 260) }}
        >
          <div className="px-3 py-1.5 text-xs font-semibold text-slate-500">{ctxInstance?.code} kursu</div>
          {isSLO && (
            <>
              <button
                onClick={() => void handleLocation('Elmlər')}
                className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
              >
                Keçirilmə yeri: Elmlər
              </button>
              <button
                onClick={() => void handleLocation('Ramana')}
                className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
              >
                Keçirilmə yeri: Ramana
              </button>
              <div className="my-1 border-t border-slate-100" />
            </>
          )}
          <button
            onClick={() => void handleContextDelete(true)}
            className="block w-full rounded-md px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
          >
            Kursu sil
          </button>
          <button
            onClick={() => void handleContextDelete(false)}
            className="block w-full rounded-md px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
          >
            Bu günü sil
          </button>
        </div>
      )}
      {ctxMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setCtxMenu(null)} onContextMenu={(e) => e.preventDefault()} />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) void data.deleteMonth(confirmDelete.id)
          setConfirmDelete(null)
        }}
        title="Ayı sil"
        danger
        confirmLabel="Sil"
        message={
          <>
            <b>{confirmDelete?.name}</b> ayını silmək üzrəsiniz. Bu aya aid bütün kurs və ödəniş məlumatları
            silinəcək. Davam etmək istəyirsiniz?
          </>
        }
      />
    </div>
  )
}

function paymentLabel(s: 'DEFAULT' | 'UNPAID' | 'PAID' | 'MIXED'): string {
  if (s === 'PAID') return 'Ödənilib'
  if (s === 'UNPAID') return 'Ödənilməyib'
  if (s === 'MIXED') return 'Qismən ödənilib'
  return 'Müəyyən edilməyib'
}

function Cell({
  dataCell,
  cell,
  teacherId,
  day,
  selected,
  editing,
  editValue,
  highlighted,
  instance,
  course,
  settings,
  onSelect,
  onBeginEdit,
  onDoubleClick,
  onRightClick,
  onLongPressStart,
  onLongPressEnd,
  onEditKeyDown,
  onCellKeyDown,
}: {
  dataCell: string
  cell: CellValue | undefined
  teacherId: string
  day: number
  selected: boolean
  editing: boolean
  editValue: string
  highlighted: boolean
  instance: CourseInstance | undefined
  course: Course | undefined
  settings: Settings
  onSelect: (t: string, d: number) => void
  onBeginEdit: (t: string, d: number, v: string) => void
  onDoubleClick: (t: string, d: number) => void
  onRightClick: (e: MouseEvent, t: string, d: number) => void
  onLongPressStart: (t: string, d: number) => void
  onLongPressEnd: () => void
  onEditKeyDown: (e: React.KeyboardEvent) => void
  onCellKeyDown: (e: KeyboardEvent, t: string, d: number) => void
}) {
  const color = cellColor(cell, instance, settings.colors)
  const tooltip = cellTooltip(cell, instance, course, settings)
  const bg = cell?.value === 'X' ? '#e2e8f0' : selected ? '#dbeafe' : '#ffffff'

  return (
    <td
      data-testid={`cell-${dataCell}`}
      tabIndex={0}
      className={`border-b border-r border-slate-200 p-0 outline-none focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400 ${
        highlighted ? 'ring-2 ring-inset ring-emerald-400' : ''
      }`}
      style={{ background: bg, minWidth: 52 }}
      onClick={() => onSelect(teacherId, day)}
      onKeyDown={(e) => onCellKeyDown(e, teacherId, day)}
      onDoubleClick={() => onDoubleClick(teacherId, day)}
      onContextMenu={(e) => onRightClick(e, teacherId, day)}
      onMouseDown={() => onLongPressStart(teacherId, day)}
      onMouseUp={onLongPressEnd}
      onMouseLeave={onLongPressEnd}
      onTouchStart={() => onLongPressStart(teacherId, day)}
      onTouchEnd={onLongPressEnd}
      onTouchMove={onLongPressEnd}
      title={tooltip || undefined}
    >
      {editing ? (
        <input
          autoFocus
          value={editValue}
          onChange={(e) => onBeginEdit(teacherId, day, e.target.value)}
          onBlur={() =>
            onEditKeyDown({ key: 'Enter', preventDefault: () => {} } as unknown as KeyboardEvent)
          }
          onKeyDown={onEditKeyDown}
          className="h-8 w-full border-0 bg-white px-1 text-center text-sm font-semibold uppercase focus:outline-none focus:ring-2 focus:ring-brand-400"
          style={{ minWidth: 52 }}
        />
      ) : (
        <div
          className="relative flex h-8 items-center justify-center px-1 text-center text-xs font-bold uppercase"
          style={{ color, minWidth: 52 }}
        >
          {cell?.value ?? ''}
          {instance?.room && (
            <span className="absolute bottom-0 right-0 rounded-tl bg-slate-200 px-1 text-[9px] font-normal text-slate-600">
              {instance.room}
            </span>
          )}
          {instance?.location && (
            <span className="absolute left-0 top-0 rounded-br bg-slate-200 px-1 text-[9px] font-normal text-slate-600">
              {instance.location}
            </span>
          )}
        </div>
      )}
    </td>
  )
}
