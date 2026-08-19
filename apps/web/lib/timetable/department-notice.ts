import { isPoolFyugpCategory, timetableEntryDisplay } from './entry-display';
import type { TimetableEntry, TimetableMatrix, TimetableMatrixRow } from '../../services/timetable';

export const NOTICE_DAY_ORDER = [1, 2, 3, 4, 5, 6] as const;

const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export type NoticePeriodColumn = {
  key: string;
  label: string;
  startTime: string;
  endTime: string;
  isBreak: boolean;
  periodNo?: number | null;
};

function clock(value?: string | null) {
  if (!value) return '';
  if (/^\d{1,2}:\d{2}/.test(value)) return value.slice(0, 5).replace(/^(\d):/, '0$1:');
  const iso = value.match(/T(\d{2}:\d{2})/);
  return iso?.[1] ?? value;
}

function staffCodes(entry: TimetableEntry): string[] {
  const codes: string[] = [];
  const push = (raw?: string | null) => {
    const code = String(raw ?? '').trim();
    if (!code) return;
    if (codes.some((c) => c.toUpperCase() === code.toUpperCase())) return;
    codes.push(code);
  };
  push(entry.staffProfile?.shortCode);
  const team = Array.isArray(entry.metadata?.facultyTeam)
    ? (entry.metadata?.facultyTeam as Array<{ shortCode?: string; facultyInitial?: string }>)
    : [];
  for (const member of team) {
    push(member.shortCode ?? member.facultyInitial);
  }
  return codes;
}

function noticeCellKey(entry: TimetableEntry): string {
  const display = timetableEntryDisplay(entry);
  const category = display.category;
  if (
    display.categoryOnly ||
    isPoolFyugpCategory(category) ||
    category === 'MAJOR' ||
    category === 'MINOR'
  ) {
    return category;
  }
  return display.code && display.code !== category ? display.code : category;
}

/** Compact paper label: "MDC KP" / "MDC BC,KA" / "MAJOR SS". */
export function formatNoticeCell(entries: TimetableEntry[]): string {
  if (!entries.length) return '';
  const groups = new Map<string, string[]>();
  for (const entry of entries) {
    const key = noticeCellKey(entry);
    const list = groups.get(key) ?? [];
    for (const code of staffCodes(entry)) {
      if (!list.some((existing) => existing.toUpperCase() === code.toUpperCase())) {
        list.push(code);
      }
    }
    groups.set(key, list);
  }
  return [...groups.entries()]
    .map(([label, codes]) => (codes.length ? `${label} ${codes.join(',')}` : label))
    .join(' / ');
}

export function noticeSemesterRows(
  matrix: TimetableMatrix | undefined,
  fallbackMode?: string | null,
): number[] {
  const present = new Set<number>();
  for (const row of matrix?.rows ?? []) {
    for (const entry of row.entries ?? []) {
      if (entry.semesterSequence != null) present.add(Number(entry.semesterSequence));
    }
  }
  const mode = String(fallbackMode ?? matrix?.summary?.semesterMode ?? 'ODD').toUpperCase();
  const defaults = mode === 'EVEN' ? [2, 4, 6] : [1, 3, 5];
  const extras = [...present].filter((sem) => !defaults.includes(sem)).sort((a, b) => a - b);
  return [...defaults, ...extras];
}

function periodKey(row: Pick<TimetableMatrixRow, 'startTime' | 'endTime'>) {
  return `${clock(row.startTime)}-${clock(row.endTime)}`;
}

/** Shared Mon–Fri period columns, including the lunch/break column. */
export function weekdayNoticeColumns(matrix: TimetableMatrix | undefined): NoticePeriodColumn[] {
  const rows = (matrix?.rows ?? []).filter((row) => row.dayOfWeek >= 1 && row.dayOfWeek <= 5);
  return uniquePeriodColumns(rows.length ? rows : (matrix?.rows ?? []));
}

/** Saturday half-day: teaching periods that exist on Saturday only. */
export function saturdayNoticeColumns(matrix: TimetableMatrix | undefined): NoticePeriodColumn[] {
  const rows = (matrix?.rows ?? []).filter((row) => row.dayOfWeek === 6);
  const cols = uniquePeriodColumns(rows);
  if (cols.length) return cols.filter((col) => !col.isBreak);
  return weekdayNoticeColumns(matrix)
    .filter((col) => !col.isBreak)
    .slice(0, 3);
}

function uniquePeriodColumns(rows: TimetableMatrixRow[]): NoticePeriodColumn[] {
  const seen = new Map<string, NoticePeriodColumn>();
  const ordered: NoticePeriodColumn[] = [];
  const sorted = [...rows].sort(
    (a, b) => clock(a.startTime).localeCompare(clock(b.startTime)) || a.dayOfWeek - b.dayOfWeek,
  );
  for (const row of sorted) {
    const key = periodKey(row);
    if (seen.has(key)) continue;
    const col: NoticePeriodColumn = {
      key,
      label: `${clock(row.startTime)} - ${clock(row.endTime)}`,
      startTime: clock(row.startTime),
      endTime: clock(row.endTime),
      isBreak: Boolean(row.isBreak || row.isLunch),
      periodNo: row.periodNo,
    };
    seen.set(key, col);
    ordered.push(col);
  }
  return ordered;
}

export function entriesForNoticeCell(
  matrix: TimetableMatrix | undefined,
  dayOfWeek: number,
  semester: number,
  column: NoticePeriodColumn,
): TimetableEntry[] {
  if (column.isBreak) return [];
  const rows = (matrix?.rows ?? []).filter(
    (row) =>
      row.dayOfWeek === dayOfWeek &&
      clock(row.startTime) === column.startTime &&
      clock(row.endTime) === column.endTime,
  );
  return rows.flatMap((row) =>
    (row.entries ?? []).filter((entry) => {
      if (entry.semesterSequence == null) return true;
      return Number(entry.semesterSequence) === semester;
    }),
  );
}

export function noticeDayLabel(dayOfWeek: number) {
  return DAY_NAMES[dayOfWeek] ?? `Day ${dayOfWeek}`;
}
