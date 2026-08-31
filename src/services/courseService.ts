import { ref, update } from 'firebase/database'
import { db } from './firebase'
import type { CellValue, Course, CourseInstance } from '../types'

export type WriteEntry = { path: string; value: unknown }

export type CellKey = { monthId: string; teacherId: string; day: number }

export { buildPlacement, cellLookupKey, cellPath, newInstanceId, pad } from './placement'
export type { PlaceResult } from './placement'

export async function applyWrites(writes: WriteEntry[]) {
  if (writes.length === 0) return
  const payload: Record<string, unknown> = {}
  for (const w of writes) payload[w.path] = w.value
  await update(ref(db), payload)
}

export type { CellValue, Course, CourseInstance }
