import { useMemo, useState } from 'react'
import { Archive, CalendarRange, Trash2, Users, BookOpen, Clock } from 'lucide-react'
import { useData } from '../store/DataContext'
import { Badge, Button, ConfirmDialog, EmptyState, PageHeader } from '../components/ui'

export function ArchivePage() {
  const { months, archives, addArchive, deleteArchive } = useData()
  const [confirmArchive, setConfirmArchive] = useState<{ year: number; monthCount: number } | null>(null)
  const [confirmDeleteArchive, setConfirmDeleteArchive] = useState<string | null>(null)

  const activeMonths = useMemo(
    () => Object.values(months).filter((m) => !m.deletedAt).sort((a, b) => a.id.localeCompare(b.id)),
    [months],
  )

  const archiveList = useMemo(
    () => Object.values(archives).sort((a, b) => b.archivedAt - a.archivedAt),
    [archives],
  )

  // Check if any year has all 12 months
  const archivableYears = useMemo(() => {
    const yearCounts = new Map<number, number>()
    for (const m of activeMonths) {
      yearCounts.set(m.year, (yearCounts.get(m.year) ?? 0) + 1)
    }
    const result: { year: number; monthCount: number }[] = []
    for (const [year, count] of yearCounts) {
      if (count >= 12) {
        result.push({ year, monthCount: count })
      }
    }
    return result
  }, [activeMonths])

  const handleArchive = (year: number) => {
    const yearMonths = Object.fromEntries(
      Object.entries(months).filter(([, m]) => !m.deletedAt && (m.year === year || m.year === year + 1))
    )
    setConfirmArchive({ year, monthCount: Object.keys(yearMonths).length })
  }

  const confirmArchiveAction = async () => {
    if (!confirmArchive) return
    const yearMonths = Object.fromEntries(
      Object.entries(months).filter(([, m]) => !m.deletedAt && (m.year === confirmArchive.year || m.year === confirmArchive.year + 1))
    )
    await addArchive(confirmArchive.year, yearMonths)
    setConfirmArchive(null)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Arxiv"
        subtitle="Tamamlanmış tədris illərinin arxivi"
      />

      {/* Archivable years */}
      {archivableYears.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-amber-800">
            <Archive size={16} />
            Arxivləşdirilməyə hazır illər
          </div>
          <div className="mt-2 space-y-2">
            {archivableYears.map(({ year, monthCount }) => (
              <div key={year} className="flex items-center justify-between">
                <span className="text-sm text-amber-700">
                  {year}-{year + 1} — {monthCount} ay mövcuddur
                </span>
                <Button variant="secondary" size="sm" onClick={() => handleArchive(year)}>
                  <Archive size={14} />
                  Arxivləşdir
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Archived years */}
      {archiveList.length === 0 ? (
        <EmptyState
          title="Hələ heç bir arxiv yoxdur"
          description="12 aylıq tədris dövrü tamamlandıqda illik arxiv yaradıla bilər."
        />
      ) : (
        <div className="space-y-4">
          {archiveList.map((archive) => {
            const instanceCount = Object.keys(archive.courseInstances).length
            const teacherCount = Object.keys(archive.teachers).filter((id) => archive.teachers[id]?.active).length
            const totalHours = Object.values(archive.courseInstances).reduce((sum, i) => sum + i.hours, 0)
            const totalAmount = Object.values(archive.courseInstances).reduce(
              (sum, i) => sum + (i.price ?? archive.settings.defaultCoursePrice),
              0,
            )

            return (
              <div key={archive.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Archive size={18} className="text-slate-500" />
                      <h3 className="text-lg font-bold text-slate-800">{archive.name}</h3>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      Arxivləşdirildi: {new Date(archive.archivedAt).toLocaleDateString('az-AZ')}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteArchive(archive.id)}>
                    <Trash2 size={14} className="text-red-500" />
                  </Button>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <CalendarRange size={12} />
                      Aylar
                    </div>
                    <div className="mt-1 text-lg font-bold text-slate-800">{Object.keys(archive.months).length}</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Users size={12} />
                      Müəllimlər
                    </div>
                    <div className="mt-1 text-lg font-bold text-slate-800">{teacherCount}</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <BookOpen size={12} />
                      Kurslar
                    </div>
                    <div className="mt-1 text-lg font-bold text-slate-800">{instanceCount}</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Clock size={12} />
                      Ümumi saat
                    </div>
                    <div className="mt-1 text-lg font-bold text-slate-800">{totalHours}</div>
                  </div>
                </div>

                {/* Month list */}
                <div className="mt-4">
                  <h4 className="text-xs font-bold text-slate-500">Aylar</h4>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {Object.values(archive.months)
                      .sort((a, b) => a.id.localeCompare(b.id))
                      .map((m) => (
                        <Badge key={m.id} tone="slate">{m.name}</Badge>
                      ))}
                  </div>
                </div>

                <div className="mt-3 text-xs text-slate-400">
                  Ümumi məbləğ: <span className="font-semibold text-slate-600">{totalAmount} AZN</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Archive confirm dialog */}
      <ConfirmDialog
        open={!!confirmArchive}
        onClose={() => setConfirmArchive(null)}
        onConfirm={() => void confirmArchiveAction()}
        title="İli arxivləşdir"
        confirmLabel="Arxivləşdir"
        message={
          <>
            <b>{confirmArchive?.year}-{(confirmArchive?.year ?? 0) + 1}</b> tədris ili arxivləşdiriləcək.
            Bu ilə aid bütün aylar, kurslar və ödəniş məlumatları arxivə köçürüləcək.
            Aktiv aylardan silinəcək. Davam etmək istəyirsiniz?
          </>
        }
      />

      {/* Delete archive confirm dialog */}
      <ConfirmDialog
        open={!!confirmDeleteArchive}
        onClose={() => setConfirmDeleteArchive(null)}
        onConfirm={() => {
          if (confirmDeleteArchive) void deleteArchive(confirmDeleteArchive)
          setConfirmDeleteArchive(null)
        }}
        title="Arxivi sil"
        danger
        confirmLabel="Sil"
        message={
          <>
            Bu arxiv həmişəlik silinəcək. Bütün məlumatlar itiriləcək.
            Bu əməliyyat geri qaytarıla bilməz. Davam etmək istəyirsiniz?
          </>
        }
      />
    </div>
  )
}
