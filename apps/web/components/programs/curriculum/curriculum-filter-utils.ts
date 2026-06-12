import type { CurriculumFilters } from '@/types/curriculum-filters';
import { emptyCurriculumFilters } from '@/types/curriculum-filters';

/** Primary toolbar filters — excluded from "advanced" badge count. */
const PRIMARY_KEYS: (keyof CurriculumFilters)[] = [
  'search',
  'programVersionId',
  'categories',
  'semesters',
];

export function countAdvancedCurriculumFilters(filters: CurriculumFilters): number {
  const empty = emptyCurriculumFilters();
  let count = 0;

  if (filters.departmentId && filters.departmentId !== empty.departmentId) count += 1;
  if (filters.streamId && filters.streamId !== empty.streamId) count += 1;
  if (filters.shiftId && filters.shiftId !== empty.shiftId) count += 1;
  if (filters.batchId && filters.batchId !== empty.batchId) count += 1;
  if (filters.sharedPool && filters.sharedPool !== empty.sharedPool) count += 1;
  if (filters.mappingStatus && filters.mappingStatus !== empty.mappingStatus) count += 1;
  if (filters.deliveryType && filters.deliveryType !== empty.deliveryType) count += 1;
  if (filters.credits && filters.credits !== empty.credits) count += 1;
  if (filters.enrollmentStatus && filters.enrollmentStatus !== empty.enrollmentStatus) count += 1;
  if (filters.facultyAssigned && filters.facultyAssigned !== empty.facultyAssigned) count += 1;
  if (filters.versionStatus && filters.versionStatus !== empty.versionStatus) count += 1;
  if (filters.quickToggle && filters.quickToggle !== empty.quickToggle) count += 1;

  return count;
}

export function clearAdvancedCurriculumFilters(
  filters: CurriculumFilters,
): Partial<CurriculumFilters> {
  return {
    departmentId: '',
    streamId: '',
    shiftId: '',
    batchId: '',
    sharedPool: '',
    mappingStatus: '',
    deliveryType: '',
    credits: '',
    enrollmentStatus: '',
    facultyAssigned: '',
    versionStatus: 'ALL',
    quickToggle: '',
  };
}

export function isPrimaryFilterKey(key: keyof CurriculumFilters): boolean {
  return PRIMARY_KEYS.includes(key);
}

export function optionsToMap(options: { id: string; label: string }[]): Record<string, string> {
  return Object.fromEntries(options.map((o) => [o.id, o.label]));
}

/** Keep first occurrence when infinite-scroll pages overlap on the same offering id. */
export function dedupeCurriculumOfferingRows<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}
