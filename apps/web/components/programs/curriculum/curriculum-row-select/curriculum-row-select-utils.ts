import { NEP_CURRICULUM_CATEGORIES } from '@/constants/nep-curriculum-categories';
import type { CurriculumFilters, CurriculumOfferingQuery } from '@/types/curriculum-filters';
import type { CurriculumOfferingRow } from '@/types/curriculum-filters';

export type RowSelectContext = {
  programVersionId?: string;
  category?: string;
  semesterSequence?: number;
};

export type RowSelectPanelFilters = {
  search: string;
  category: string;
  semester: string;
  programVersionId: string;
  quickToggle: string;
  facultyAssigned: boolean | undefined;
};

export type GroupedCurriculumRows = {
  semester: number | null;
  semesterLabel: string;
  categories: {
    category: string;
    rows: CurriculumOfferingRow[];
  }[];
}[];

export const ROW_SELECT_QUICK_CHIPS = [
  { id: 'MAJOR', label: 'Major', kind: 'category' as const, value: 'MAJOR' },
  { id: 'MINOR', label: 'Minor', kind: 'category' as const, value: 'MINOR' },
  {
    id: 'SHARED_POOLS',
    label: 'Shared Pools',
    kind: 'quickToggle' as const,
    value: 'SHARED_POOLS',
  },
  { id: 'INTERNSHIP', label: 'Internship', kind: 'category' as const, value: 'INTERNSHIP' },
  { id: 'LABS', label: 'Labs', kind: 'quickToggle' as const, value: 'LABS' },
  { id: 'HAS_FACULTY', label: 'Has Faculty', kind: 'facultyAssigned' as const, value: 'true' },
] as const;

export const CATEGORY_OPTIONS = [
  { id: '', label: 'All categories' },
  ...NEP_CURRICULUM_CATEGORIES.map((c) => ({ id: c, label: c })),
];

export const SEMESTER_OPTIONS = [
  { id: '', label: 'All semesters' },
  ...([1, 2, 3, 4, 5, 6, 7, 8] as const).map((s) => ({
    id: String(s),
    label: `Sem ${s}`,
  })),
];

const CATEGORY_ORDER = new Map(NEP_CURRICULUM_CATEGORIES.map((c, i) => [c, i]));

export function resolveSmartDefaults(
  offeringForm: {
    programVersionId?: string;
    category?: string;
    semesterSequence?: number;
  },
  urlFilters: Pick<CurriculumFilters, 'programVersionId' | 'categories' | 'semesters'>,
): RowSelectContext {
  return {
    programVersionId: offeringForm.programVersionId || urlFilters.programVersionId || undefined,
    category: offeringForm.category || urlFilters.categories[0] || undefined,
    semesterSequence: offeringForm.semesterSequence ?? urlFilters.semesters[0] ?? undefined,
  };
}

export function urlFiltersFromSearchParams(
  params: URLSearchParams,
): Pick<CurriculumFilters, 'programVersionId' | 'categories' | 'semesters'> {
  const semRaw = params.get('sem');
  const semesters = semRaw
    ? semRaw
        .split(',')
        .map((p) => Number(p.trim()))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 8)
    : [];
  const categoryRaw = params.get('category');
  const categories = categoryRaw?.split(',').filter(Boolean) ?? [];
  return {
    programVersionId: params.get('programVersionId') ?? '',
    categories,
    semesters,
  };
}

export function buildInitialPanelFilters(
  context: RowSelectContext,
  showAllMappings: boolean,
): RowSelectPanelFilters {
  if (showAllMappings) {
    return {
      search: '',
      category: '',
      semester: '',
      programVersionId: context.programVersionId ?? '',
      quickToggle: '',
      facultyAssigned: undefined,
    };
  }
  return {
    search: '',
    category: context.category ?? '',
    semester: context.semesterSequence != null ? String(context.semesterSequence) : '',
    programVersionId: context.programVersionId ?? '',
    quickToggle: '',
    facultyAssigned: undefined,
  };
}

export function panelFiltersToQuery(filters: RowSelectPanelFilters): CurriculumOfferingQuery {
  const query: CurriculumOfferingQuery = {
    limit: 50,
  };
  if (filters.search.trim()) query.search = filters.search.trim();
  if (filters.programVersionId) query.programVersionId = filters.programVersionId;
  if (filters.category) query.category = filters.category;
  if (filters.semester) query.semesterSequence = filters.semester;
  if (filters.quickToggle) query.quickToggle = filters.quickToggle;
  if (filters.facultyAssigned === true) query.facultyAssigned = true;
  return query;
}

export function isQuickChipActive(
  chip: (typeof ROW_SELECT_QUICK_CHIPS)[number],
  filters: RowSelectPanelFilters,
): boolean {
  if (chip.kind === 'category') return filters.category === chip.value && !filters.quickToggle;
  if (chip.kind === 'quickToggle') return filters.quickToggle === chip.value;
  if (chip.kind === 'facultyAssigned') return filters.facultyAssigned === true;
  return false;
}

export function toggleQuickChip(
  chip: (typeof ROW_SELECT_QUICK_CHIPS)[number],
  filters: RowSelectPanelFilters,
): RowSelectPanelFilters {
  const active = isQuickChipActive(chip, filters);
  if (active) {
    if (chip.kind === 'category') return { ...filters, category: '' };
    if (chip.kind === 'quickToggle') return { ...filters, quickToggle: '' };
    return { ...filters, facultyAssigned: undefined };
  }
  const next: RowSelectPanelFilters = {
    ...filters,
    category: '',
    quickToggle: '',
    facultyAssigned: undefined,
  };
  if (chip.kind === 'category') next.category = chip.value;
  if (chip.kind === 'quickToggle') next.quickToggle = chip.value;
  if (chip.kind === 'facultyAssigned') next.facultyAssigned = true;
  return next;
}

export function groupCurriculumRowsBySemesterAndCategory(
  rows: CurriculumOfferingRow[],
): GroupedCurriculumRows {
  const bySemester = new Map<number | null, Map<string, CurriculumOfferingRow[]>>();

  for (const row of rows) {
    const sem = row.semesterSequence ?? null;
    if (!bySemester.has(sem)) bySemester.set(sem, new Map());
    const cat = row.category ?? 'OTHER';
    const catMap = bySemester.get(sem)!;
    if (!catMap.has(cat)) catMap.set(cat, []);
    catMap.get(cat)!.push(row);
  }

  const semesters = [...bySemester.keys()].sort((a, b) => {
    if (a == null) return 1;
    if (b == null) return -1;
    return a - b;
  });

  return semesters.map((semester) => {
    const catMap = bySemester.get(semester)!;
    const categories = [...catMap.keys()].sort((a, b) => {
      const ai = CATEGORY_ORDER.get(a as (typeof NEP_CURRICULUM_CATEGORIES)[number]) ?? 999;
      const bi = CATEGORY_ORDER.get(b as (typeof NEP_CURRICULUM_CATEGORIES)[number]) ?? 999;
      if (ai !== bi) return ai - bi;
      return a.localeCompare(b);
    });
    return {
      semester,
      semesterLabel: semester != null && semester >= 1 ? `Semester ${semester}` : 'No semester',
      categories: categories.map((category) => ({
        category,
        rows: catMap.get(category) ?? [],
      })),
    };
  });
}

export function formatRowPrimaryLabel(row: CurriculumOfferingRow): string {
  return `${row.course.code} — ${row.course.title}`;
}

export function formatRowSecondaryLabel(row: CurriculumOfferingRow): string {
  const parts: string[] = [];
  if (row.programVersion?.program?.code) {
    parts.push(`${row.programVersion.program.code} v${row.programVersion.version}`);
  } else if (row.poolName) {
    parts.push(row.poolName);
  } else if (row.mappingSource === 'SHARED_POOL') {
    parts.push('Shared pool');
  }
  if (row.category) parts.push(row.category);
  if (row.semesterSequence != null && row.semesterSequence >= 1) {
    parts.push(`Sem ${row.semesterSequence}`);
  }
  const credits = row.course?.credits;
  if (credits != null && Number.isFinite(Number(credits))) {
    parts.push(`${Number(credits)}cr`);
  }
  return parts.join(' · ');
}
