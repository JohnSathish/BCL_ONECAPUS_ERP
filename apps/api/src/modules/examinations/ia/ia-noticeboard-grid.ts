import {
  FYUGP_FIRST_IA_SEM_DAY_PLAN,
  inferFyugpRoutinePattern,
  majorGroupKey,
  normalizeFyugpCategory,
  type FyugpPaperLike,
  type FyugpRoutinePattern,
} from './fyugp-first-ia-routine';
import type { NoticeboardRow } from './templates/ia-noticeboard-routine.template';

export type NoticeboardPaper = FyugpPaperLike & {
  examDate?: Date | string | null;
  startTime?: Date | string | null;
  endTime?: Date | string | null;
  metadata?: { category?: string; programmeCode?: string } | null;
};

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatDisplayDate(d: Date) {
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`;
}

function formatDayName(d: Date) {
  return d.toLocaleDateString('en-IN', { weekday: 'long' }).toUpperCase();
}

function formatClock(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    const m = value.match(/(\d{1,2}):(\d{2})/);
    if (m) return `${pad2(Number(m[1]))}:${m[2]}`;
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
    }
    return null;
  }
  // Prisma TIME often comes as Date with UTC hours
  return `${pad2(value.getUTCHours())}:${pad2(value.getUTCMinutes())}`;
}

function formatTiming(
  pattern: FyugpRoutinePattern,
  start: string | null,
  end: string | null,
  options?: { afternoon?: boolean },
): string {
  const startPretty = start ? toNoticeClock(start) : null;
  const endPretty = end ? toNoticeClock(end) : null;
  if (startPretty && endPretty) {
    // Official Day Shift notice labels morning papers as "MORNING 9:45-10:40"
    // and Friday VAC as plain "1:45-2:10" (12-hour, not 13:45).
    if (options?.afternoon || (start && start.startsWith('13'))) {
      return `AFTERNOON ${startPretty}-${endPretty}`;
    }
    if (pattern === 'MORNING' || pattern === 'DAY') {
      return `MORNING ${startPretty}-${endPretty}`;
    }
  }
  return pattern === 'MORNING' ? 'MORNING 7:15-8:00' : 'MORNING 9:45-10:40';
}

/** Official notice uses 12-hour clock without AM/PM (9:45, 1:45 — not 13:45). */
function toNoticeClock(hhmm: string): string {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return hhmm.replace(/^0/, '');
  const h24 = Number(m[1]);
  const mins = m[2];
  const h12 = h24 % 12 || 12;
  // Keep 10/11/12 as-is; drop only a leading zero on single-digit hours.
  return `${h12}:${mins}`;
}

function paperCategory(p: NoticeboardPaper) {
  return (
    p.category ??
    (p.metadata && typeof p.metadata === 'object'
      ? String(p.metadata.category ?? '')
      : null)
  );
}

function withProgramme(p: NoticeboardPaper): FyugpPaperLike {
  return {
    id: p.id,
    paperCode: p.paperCode,
    semesterNo: p.semesterNo,
    category: paperCategory(p),
    programmeCode:
      p.programmeCode ??
      (p.metadata && typeof p.metadata === 'object'
        ? String(p.metadata.programmeCode ?? '')
        : null),
  };
}

/** Display label for a paper as it appears on the printed notice. */
export function noticeboardSlotLabel(
  paper: NoticeboardPaper,
  majorIndexById: Map<string, number>,
): string | null {
  const family = normalizeFyugpCategory(paperCategory(paper));
  if (!family) return null;
  if (family !== 'MAJOR') return family;
  const sem = paper.semesterNo ?? 0;
  const idx = majorIndexById.get(paper.id) ?? 0;
  if (sem === 1) return 'MAJOR';
  return `MAJOR ${idx + 1}`;
}

function buildMajorIndexMap(papers: NoticeboardPaper[]) {
  const majors = papers
    .filter((p) => normalizeFyugpCategory(paperCategory(p)) === 'MAJOR')
    .map(withProgramme);
  // Rank majors within each semester + department stem (not across semesters).
  const bySemGroup = new Map<string, FyugpPaperLike[]>();
  for (const p of majors) {
    const key = `${p.semesterNo ?? 0}|${majorGroupKey(p)}`;
    if (!bySemGroup.has(key)) bySemGroup.set(key, []);
    bySemGroup.get(key)!.push(p);
  }
  const majorIndexById = new Map<string, number>();
  for (const group of bySemGroup.values()) {
    group
      .slice()
      .sort((a, b) => a.paperCode.localeCompare(b.paperCode))
      .forEach((p, index) => majorIndexById.set(p.id, index));
  }
  return majorIndexById;
}

function pickLabel(labels: Set<string>): string {
  if (!labels.size) return '--------';
  // Prefer MAJOR n order then alpha
  const sorted = [...labels].sort((a, b) => {
    const ma = a.match(/^MAJOR\s+(\d+)$/);
    const mb = b.match(/^MAJOR\s+(\d+)$/);
    if (ma && mb) return Number(ma[1]) - Number(mb[1]);
    if (a === 'MAJOR') return -1;
    if (b === 'MAJOR') return 1;
    return a.localeCompare(b);
  });
  // Printed notice shows one family per cell; if multiple, join with " / "
  return sorted.join(' / ');
}

/**
 * Build noticeboard rows from scheduled papers (preferred).
 * Falls back to empty array if papers lack exam dates.
 */
export function buildNoticeboardRowsFromPapers(
  papers: NoticeboardPaper[],
  pattern: FyugpRoutinePattern,
  semesterColumns: number[] = [1, 3, 5],
): NoticeboardRow[] {
  const dated = papers.filter((p) => asDate(p.examDate));
  if (!dated.length) return [];

  const majorIndexById = buildMajorIndexMap(dated);
  const byDate = new Map<
    string,
    {
      date: Date;
      starts: string[];
      ends: string[];
      labelsBySem: Map<number, Set<string>>;
    }
  >();

  for (const p of dated) {
    const d = asDate(p.examDate)!;
    const key = dateKey(d);
    if (!byDate.has(key)) {
      byDate.set(key, {
        date: d,
        starts: [],
        ends: [],
        labelsBySem: new Map(
          semesterColumns.map((s) => [s, new Set<string>()]),
        ),
      });
    }
    const bucket = byDate.get(key)!;
    const st = formatClock(p.startTime);
    const et = formatClock(p.endTime);
    if (st) bucket.starts.push(st);
    if (et) bucket.ends.push(et);
    const sem = p.semesterNo ?? 0;
    if (!semesterColumns.includes(sem)) continue;
    const label = noticeboardSlotLabel(p, majorIndexById);
    if (label) bucket.labelsBySem.get(sem)?.add(label);
  }

  const sorted = [...byDate.values()].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );

  return sorted.map((bucket, index) => {
    const start =
      bucket.starts.sort()[0] ?? (pattern === 'MORNING' ? '07:15' : '09:45');
    const end =
      bucket.ends.sort().at(-1) ?? (pattern === 'MORNING' ? '08:00' : '10:40');
    // Prefer afternoon timing when any paper that day starts at 13:xx
    const afternoon = bucket.starts.find((s) => s.startsWith('13'));
    const timingStart = afternoon ?? start;
    const timingEnd = afternoon
      ? (bucket.ends.find((e) => e.startsWith('14')) ?? '14:10')
      : end;

    return {
      slNo: index + 1,
      dateLabel: formatDisplayDate(bucket.date),
      dayLabel: formatDayName(bucket.date),
      timingLabel: formatTiming(pattern, timingStart, timingEnd),
      sem1: pickLabel(bucket.labelsBySem.get(1) ?? new Set()),
      sem3: pickLabel(bucket.labelsBySem.get(3) ?? new Set()),
      sem5: pickLabel(bucket.labelsBySem.get(5) ?? new Set()),
    };
  });
}

/**
 * Build noticeboard from the canonical FYUGP day plan when papers are undated.
 */
export function buildNoticeboardRowsFromPlan(
  startDateIso: string,
  pattern: FyugpRoutinePattern,
): NoticeboardRow[] {
  const [y, m, d] = startDateIso.split('-').map(Number);
  if (!y || !m || !d) return [];

  const dayLabels = new Map<
    number,
    { sem1: string; sem3: string; sem5: string }
  >();
  for (const sem of [1, 3, 5] as const) {
    const plan = FYUGP_FIRST_IA_SEM_DAY_PLAN[sem];
    if (!plan) continue;
    for (const [dayStr, target] of Object.entries(plan)) {
      const dayOffset = Number(dayStr);
      const label =
        target.family === 'MAJOR'
          ? sem === 1
            ? 'MAJOR'
            : `MAJOR ${('majorIndex' in target ? target.majorIndex : 0) + 1}`
          : target.family;
      if (!dayLabels.has(dayOffset)) {
        dayLabels.set(dayOffset, {
          sem1: '--------',
          sem3: '--------',
          sem5: '--------',
        });
      }
      const row = dayLabels.get(dayOffset)!;
      if (sem === 1) row.sem1 = label;
      if (sem === 3) row.sem3 = label;
      if (sem === 5) row.sem5 = label;
    }
  }

  // Day Shift: Sem1 VAC moves off Saturday onto Friday afternoon as its own row.
  // Friday morning keeps SEC (Sem1/3) + MINOR (Sem5).
  let dayVacAfternoon: {
    sem1: string;
    sem3: string;
    sem5: string;
  } | null = null;
  if (pattern === 'DAY') {
    const sat = dayLabels.get(5);
    if (sat?.sem1 === 'VAC') {
      dayVacAfternoon = {
        sem1: 'VAC',
        sem3: '--------',
        sem5: '--------',
      };
      dayLabels.delete(5);
    }
  }

  const offsets = [...dayLabels.keys()].sort((a, b) => a - b);
  const rows: NoticeboardRow[] = [];
  let slNo = 1;

  for (const offset of offsets) {
    const date = new Date(y, m - 1, d + offset);
    const cells = dayLabels.get(offset)!;
    const start = pattern === 'MORNING' ? '07:15' : '09:45';
    const end = pattern === 'MORNING' ? '08:00' : '10:40';
    rows.push({
      slNo: slNo++,
      dateLabel: formatDisplayDate(date),
      dayLabel: formatDayName(date),
      timingLabel: formatTiming(pattern, start, end),
      sem1: cells.sem1,
      sem3: cells.sem3,
      sem5: cells.sem5,
    });

    // Official Day Shift: same Friday date, second line for VAC 1:45–2:10.
    if (pattern === 'DAY' && offset === 4 && dayVacAfternoon) {
      rows.push({
        slNo: slNo++,
        dateLabel: formatDisplayDate(date),
        dayLabel: formatDayName(date),
        timingLabel: formatTiming(pattern, '13:45', '14:10', {
          afternoon: true,
        }),
        sem1: dayVacAfternoon.sem1,
        sem3: dayVacAfternoon.sem3,
        sem5: dayVacAfternoon.sem5,
      });
    }
  }

  return rows;
}

export function resolveNoticeboardPattern(
  shiftName?: string | null,
  metadataPattern?: string | null,
): FyugpRoutinePattern {
  if (metadataPattern === 'MORNING' || metadataPattern === 'DAY') {
    return metadataPattern;
  }
  return inferFyugpRoutinePattern(shiftName);
}
