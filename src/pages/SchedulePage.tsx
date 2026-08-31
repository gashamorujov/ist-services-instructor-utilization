import { useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import { Calendar, Download, DownloadCloud, Plus, Search, Trash2 } from 'lucide-react'
import { useData } from '../store/DataContext'
import { CoursePanel } from '../components/CoursePanel'
import { Badge, Button, ConfirmDialog, EmptyState } from '../components/ui'
import { computeActivePayments, paymentRowStatus, cellColor, cellTooltip } from '../utils/calc'
import { dateKey, formatDateAZ, monthName } from '../utils/dates'
import type { CellValue, Course, CourseInstance, Month, Settings } from '../types'

type Editing = {
  teacherId: string
  day: number
  value: string
}

type SelectionAnchor = { teacherId: string; day: number }

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

  // Month picker for empty state
  const now = new Date()
  const [pickerYear, setPickerYear] = useState(now.getFullYear())
  const [pickerMonth, setPickerMonth] = useState(now.getMonth() + 1)

  // Multi-cell selection
  const [isDragging, setIsDragging] = useState(false)
  const [selectionAnchor, setSelectionAnchor] = useState<SelectionAnchor | null>(null)
  const [selectionEnd, setSelectionEnd] = useState<SelectionAnchor | null>(null)

  const monthCells = currentMonth ? cellsByMonth[currentMonth.id] ?? {} : {}
  const activeTeachers = useMemo(
    () => Object.values(teachers).filter((t) => t.active).sort((a, b) => a.order - b.order),
    [teachers],
  )
  const dim = currentMonth ? new Date(currentMonth.year, currentMonth.month, 0).getDate() : 0

  const monthInstances = useMemo(() => {
    if (!currentMonth) return []
    return Object.values(courseInstances).filter((inst) => inst.monthId === currentMonth.id)
  }, [courseInstances, currentMonth])

  const payments = useMemo(
    () => computeActivePayments(monthInstances, activeTeachers, settings),
    [monthInstances, activeTeachers, settings],
  )

  const isCellSelected = (teacherId: string, day: number): boolean => {
    if (!selectionAnchor || !selectionEnd) return false
    const anchorIdx = activeTeachers.findIndex((t) => t.id === selectionAnchor.teacherId)
    const endIdx = activeTeachers.findIndex((t) => t.id === selectionEnd.teacherId)
    const minT = Math.min(anchorIdx, endIdx)
    const maxT = Math.max(anchorIdx, endIdx)
    const minD = Math.min(selectionAnchor.day, selectionEnd.day)
    const maxD = Math.max(selectionAnchor.day, selectionEnd.day)
    const tIdx = activeTeachers.findIndex((t) => t.id === teacherId)
    return tIdx >= minT && tIdx <= maxT && day >= minD && day <= maxD
  }

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
      // Clear all selected cells if multi-select is active
      if (selectionAnchor && selectionEnd) {
        for (const t of activeTeachers) {
          for (let d = 1; d <= dim; d++) {
            if (isCellSelected(t.id, d)) {
              await data.clearCell(currentMonth!.id, t.id, d)
            }
          }
        }
        setSelectionAnchor(null)
        setSelectionEnd(null)
      } else {
        await data.clearCell(currentMonth!.id, teacherId, day)
        setSelected(null)
      }
    } else if (e.key === 'Escape') {
      setSelectionAnchor(null)
      setSelectionEnd(null)
      setSelected(null)
    } else if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      setSelectionAnchor({ teacherId: activeTeachers[0]?.id ?? teacherId, day: 1 })
      setSelectionEnd({ teacherId: activeTeachers[activeTeachers.length - 1]?.id ?? teacherId, day: dim })
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


  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  // Mouse-based multi-cell selection
  const handleCellMouseDown = (teacherId: string, day: number) => {
    cancelLongPress()
    longPressTimer.current = window.setTimeout(() => {
      const cell = monthCells[teacherId]?.[String(day)]
      if (cell?.courseInstanceId) {
        setPanelInstance(cell.courseInstanceId)
      }
    }, 500)
    setSelectionAnchor({ teacherId, day })
    setSelectionEnd({ teacherId, day })
    setIsDragging(true)
  }

  const handleCellMouseEnter = (teacherId: string, day: number) => {
    if (isDragging) {
      setSelectionEnd({ teacherId, day })
    }
  }

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false)
      if (selectionAnchor && selectionEnd) {
        if (selectionAnchor.teacherId === selectionEnd.teacherId && selectionAnchor.day === selectionEnd.day) {
          setSelected({ teacherId: selectionAnchor.teacherId, day: selectionAnchor.day })
          setSelectionAnchor(null)
          setSelectionEnd(null)
        } else {
          setSelected(null)
        }
      }
    }
    cancelLongPress()
  }

  // Export functions
  const exportCurrent = async () => {
    if (!currentMonth) return
    const { exportMonthToExcel } = await import('../services/exportService')
    const fname = exportMonthToExcel({
      month: currentMonth,
      teachers: activeTeachers,
      courses,
      cells: monthCells,
      instances: Object.fromEntries(monthInstances.map((i) => [i.id, i])),
      settings,
    })
    data.toast(`${fname} yükləndi`)
  }

  const exportAll = async () => {
    const allMonths = Object.values(months).sort((a, b) => a.id.localeCompare(b.id))
    if (allMonths.length === 0) return
    const { exportAllMonthsToExcel } = await import('../services/exportService')
    const dataList = allMonths.map((m) => ({
      month: m,
      teachers: activeTeachers,
      courses,
      cells: cellsByMonth[m.id] ?? {},
      instances: Object.fromEntries(
        Object.values(courseInstances).filter((i) => i.monthId === m.id).map((i) => [i.id, i]),
      ),
      settings,
    }))
    const fname = exportAllMonthsToExcel(dataList)
    data.toast(`${fname} yükləndi`)
  }

  const filteredTeachers = useMemo(() => {
    if (!teacherSearch.trim()) return activeTeachers
    const q = teacherSearch.toLowerCase()
    return activeTeachers.filter((t) => t.fullName.toLowerCase().includes(q))
  }, [activeTeachers, teacherSearch])

  const selectedCount = useMemo(() => {
    if (!selectionAnchor || !selectionEnd) return 0
    const anchorIdx = activeTeachers.findIndex((t) => t.id === selectionAnchor.teacherId)
    const endIdx = activeTeachers.findIndex((t) => t.id === selectionEnd.teacherId)
    const minT = Math.min(anchorIdx, endIdx)
    const maxT = Math.max(anchorIdx, endIdx)
    const minD = Math.min(selectionAnchor.day, selectionEnd.day)
    const maxD = Math.max(selectionAnchor.day, selectionEnd.day)
    return (maxT - minT + 1) * (maxD - minD + 1)
  }, [selectionAnchor, selectionEnd, activeTeachers])

  const clearSelectedCells = async () => {
    if (!selectionAnchor || !selectionEnd || !currentMonth) return
    const ok = window.confirm(`${selectedCount} xananı təmizləmək istəyirsiniz?`)
    if (!ok) return
    for (const t of activeTeachers) {
      for (let d = 1; d <= dim; d++) {
        if (isCellSelected(t.id, d)) {
          await data.clearCell(currentMonth.id, t.id, d)
        }
      }
    }
    setSelectionAnchor(null)
    setSelectionEnd(null)
    data.toast(`${selectedCount} xana təmizləndi`)
  }

  if (!currentMonth) {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Tədris cədvəli</h1>
            <p className="mt-0.5 text-sm text-slate-500">Yeni ay seçərək cədvəl yaradın</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50">
              <Calendar size={28} className="text-brand-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">Tədris cədvəli yoxdur</h2>
            <p className="mt-1 max-w-md text-sm text-slate-500">
              Cədvəl yaratmaq üçün aşağıdakı vasitələrlə ay seçin və yaradın.
            </p>

            <div className="mt-6 flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">İl</label>
                <select
                  value={pickerYear}
                  onChange={(e) => setPickerYear(Number(e.target.value))}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                >
                  {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Ay</label>
                <select
                  value={pickerMonth}
                  onChange={(e) => setPickerMonth(Number(e.target.value))}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>{monthName(m)}</option>
                  ))}
                </select>
              </div>
              <Button
                onClick={async () => {
                  const result = await data.addMonthById(pickerYear, pickerMonth)
                  if (result) {
                    data.setActiveMonthId(result.id)
                  }
                }}
              >
                <Plus size={16} />
                Cədvəl yarat
              </Button>
            </div>

            {Object.values(months).filter((m) => !m.deletedAt).length > 0 && (
              <div className="mt-6 w-full border-t border-slate-200 pt-4">
                <p className="mb-2 text-xs font-semibold text-slate-500">Mövcud aylar</p>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {Object.values(months)
                    .filter((m) => !m.deletedAt)
                    .sort((a, b) => a.id.localeCompare(b.id))
                    .map((m) => (
                      <button
                        key={m.id}
                        onClick={() => data.setActiveMonthId(m.id)}
                        className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
                      >
                        {m.name}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const ctxCell = ctxMenu ? monthCells[ctxMenu.teacherId]?.[String(ctxMenu.day)] : undefined
  const ctxInstance = ctxCell?.courseInstanceId ? courseInstances[ctxCell.courseInstanceId] : undefined
  const ctxCourse = ctxInstance ? Object.values(courses).find(c => c.code === ctxInstance.code) : undefined
  const isSLO = ctxCourse?.code === 'SL' || ctxCourse?.code === 'SO'

  return (
    <div className="space-y-5" onMouseUp={handleMouseUp}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Tədris cədvəli</h1>
          <p className="mt-0.5 text-sm text-slate-500">{currentMonth.name} — {dim} gün</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedCount > 1 && (
            <Button variant="danger" size="sm" onClick={() => void clearSelectedCells()}>
              <Trash2 size={14} />
              Seçilən {selectedCount} xananı təmizlə
            </Button>
          )}
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={teacherSearch}
              onChange={(e) => setTeacherSearch(e.target.value)}
              placeholder="Müəllim axtar..."
              className="w-48 rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={courseSearch}
              onChange={(e) => setCourseSearch(e.target.value)}
              placeholder="Kurs axtar..."
              className="w-40 rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <Button variant="secondary" size="sm" onClick={() => void data.addMonth()}>
            <Plus size={14} />
            Ay əlavə et
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void exportCurrent()} data-testid="export-month">
            <Download size={14} />
            Bu ay
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void exportAll()} data-testid="export-all">
            <DownloadCloud size={14} />
            Hamısı
          </Button>
          <Button variant="danger" size="sm" onClick={() => setConfirmDelete(currentMonth)}>
            <Trash2 size={14} />
            Ayı sil
          </Button>
        </div>
      </div>

      {/* Month tabs */}
      <div className="flex flex-wrap gap-1.5">
        {Object.values(months)
          .filter((m) => !m.deletedAt)
          .sort((a, b) => a.id.localeCompare(b.id))
          .map((m) => (
            <button
              key={m.id}
              onClick={() => data.setActiveMonthId(m.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                m.id === activeMonthId
                  ? 'bg-brand-600 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
              data-testid={`month-tab-${m.id}`}
            >
              {m.name}
            </button>
          ))}
        <button
          onClick={() => void data.addMonth()}
          className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-400 hover:border-brand-400 hover:text-brand-600"
        >
          +
        </button>
      </div>

      {/* Schedule table */}
      {filteredTeachers.length === 0 ? (
        <EmptyState
          title="Müəllim tapılmadı"
          description={teacherSearch ? 'Axtarışa uyğun müəllim yoxdur.' : 'Bu ay üçün hələ müəllim yoxdur.'}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="schedule-table">
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 w-12 border-b border-r border-slate-200 bg-slate-50 px-2 py-2 text-center text-xs font-bold text-slate-600">
                    S/S
                  </th>
                  <th className="sticky left-[52px] z-20 min-w-[180px] border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-bold text-slate-600">
                    Müəllim
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
                    <tr key={t.id}>
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
                        const course = instance ? Object.values(courses).find(c => c.code === instance.code) : undefined
                        return (
                          <Cell
                            key={day}
                            dataCell={`${t.id}-${day}`}
                            cell={cell}
                            teacherId={t.id}
                            day={day}
                            selected={selected?.teacherId === t.id && selected?.day === day}
                            multiSelected={isCellSelected(t.id, day)}
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
                            onCellMouseDown={handleCellMouseDown}
                            onCellMouseEnter={handleCellMouseEnter}
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
        İpucu: Xanaya klikləyin və yazın. Enter — yadda saxla, Esc — ləğv et, Backspace/Delete — sil, iki klik — kurs paneli, sağ klik — əlavə seçimlər, uzun basma — kurs paneli. Sürüşdürməklə çoxlu xana seçin.
      </p>

      {/* Active payments */}
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

      {/* Course panel */}
      {panelInstance && <CoursePanel instanceId={panelInstance} onClose={() => setPanelInstance(null)} />}

      {/* Context menu */}
      {ctxMenu && (
        <div
          className="fixed z-50 min-w-[200px] rounded-xl border border-slate-200 bg-white p-2 shadow-xl"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
        >
          <div className="px-3 py-1.5 text-xs font-bold text-slate-400">
            {ctxInstance?.code} — {teachers[ctxMenu.teacherId]?.fullName}
          </div>
          <div className="my-1 border-t border-slate-100" />
          {ctxInstance && (
            <button
              onClick={() => {
                setPanelInstance(ctxInstance.id)
                setCtxMenu(null)
              }}
              className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
            >
              Ətraflı bax
            </button>
          )}
          <button
            onClick={() => {
              if (ctxInstance) {
                void data.updateInstance(ctxInstance.id, { paymentStatus: 'PAID' })
              }
              setCtxMenu(null)
            }}
            className="block w-full rounded-md px-3 py-2 text-left text-sm text-emerald-700 hover:bg-emerald-50"
          >
            Ödənilib kimi işarələ
          </button>
          <button
            onClick={() => {
              if (ctxInstance) {
                void data.updateInstance(ctxInstance.id, { paymentStatus: 'UNPAID' })
              }
              setCtxMenu(null)
            }}
            className="block w-full rounded-md px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
          >
            Ödənilməyib kimi işarələ
          </button>
          {isSLO && (
            <>
              <div className="my-1 border-t border-slate-100" />
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
          if (confirmDelete) void data.trashMonth(confirmDelete.id)
          setConfirmDelete(null)
        }}
        title="Ayı sil"
        danger
        confirmLabel="Sil"
        message={
          <>
            <b>{confirmDelete?.name}</b> ayını silmək üzrəsiniz. Bu aya aid bütün kurs və ödəniş məlumatları
            zibil qutusuna köçürüləcək. 24 saat ərzində bərpa edə bilərsiniz. Davam etmək istəyirsiniz?
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
  multiSelected,
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
  onCellMouseDown,
  onCellMouseEnter,
  onLongPressEnd,
  onEditKeyDown,
  onCellKeyDown,
}: {
  dataCell: string
  cell: CellValue | undefined
  teacherId: string
  day: number
  selected: boolean
  multiSelected: boolean
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
  onCellMouseDown: (t: string, d: number) => void
  onCellMouseEnter: (t: string, d: number) => void
  onLongPressEnd: () => void
  onEditKeyDown: (e: React.KeyboardEvent) => void
  onCellKeyDown: (e: KeyboardEvent, t: string, d: number) => void
}) {
  const color = cellColor(cell, instance, settings.colors)
  const tooltip = cellTooltip(cell, instance, course, settings)
  const bg = cell?.value === 'X'
    ? '#e2e8f0'
    : multiSelected
      ? '#bfdbfe'
      : selected
        ? '#dbeafe'
        : '#ffffff'

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
      onMouseDown={() => onCellMouseDown(teacherId, day)}
      onMouseEnter={() => onCellMouseEnter(teacherId, day)}
      onMouseUp={onLongPressEnd}
      onMouseLeave={onLongPressEnd}
      onTouchStart={() => onCellMouseDown(teacherId, day)}
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
