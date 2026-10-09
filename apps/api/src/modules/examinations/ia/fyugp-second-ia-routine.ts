/**
 * FYUGP Odd Semester 2nd Internal Assessment — Day Shift printed routine.
 * Start date is Monday 12 October 2026 on the official notice.
 * Afternoon sittings are 1:00–2:15. Tuesday Sem 1 AEC is 9:45–11:00.
 * Total marks 15. Duration 1 hour 15 minutes.
 */

import {
  majorGroupKey,
  normalizeFyugpCategory,
  type FyugpAssignment,
  type FyugpPaperLike,
  type FyugpRoutinePattern,
} from './fyugp-first-ia-routine';

type Family = 'MAJOR' | 'MINOR' | 'AEC' | 'MDC' | 'SEC' | 'VAC';

type Slot = {
  dayOffset: number;
  startTime: string;
  endTime: string;
  family: Family;
  majorIndex?: number;
};

/** Official Day Shift notice, 12–16 October 2026. */
const DAY_SLOTS: Record<number, Slot[]> = {
  1: [
    { dayOffset: 0, startTime: '13:00', endTime: '14:15', family: 'MDC' },
    { dayOffset: 1, startTime: '09:45', endTime: '11:00', family: 'AEC' },
    { dayOffset: 1, startTime: '13:00', endTime: '14:15', family: 'SEC' },
    { dayOffset: 2, startTime: '13:00', endTime: '14:15', family: 'VAC' },
    { dayOffset: 3, startTime: '13:00', endTime: '14:15', family: 'MINOR' },
    {
      dayOffset: 4,
      startTime: '13:00',
      endTime: '14:15',
      family: 'MAJOR',
      majorIndex: 0,
    },
  ],
  3: [
    { dayOffset: 0, startTime: '13:00', endTime: '14:15', family: 'AEC' },
    { dayOffset: 1, startTime: '13:00', endTime: '14:15', family: 'MDC' },
    { dayOffset: 2, startTime: '13:00', endTime: '14:15', family: 'SEC' },
    {
      dayOffset: 3,
      startTime: '13:00',
      endTime: '14:15',
      family: 'MAJOR',
      majorIndex: 0,
    },
    {
      dayOffset: 4,
      startTime: '13:00',
      endTime: '14:15',
      family: 'MAJOR',
      majorIndex: 1,
    },
  ],
  5: [
    { dayOffset: 0, startTime: '13:00', endTime: '14:15', family: 'MINOR' },
    {
      dayOffset: 2,
      startTime: '13:00',
      endTime: '14:15',
      family: 'MAJOR',
      majorIndex: 0,
    },
    {
      dayOffset: 3,
      startTime: '13:00',
      endTime: '14:15',
      family: 'MAJOR',
      majorIndex: 1,
    },
    {
      dayOffset: 4,
      startTime: '13:00',
      endTime: '14:15',
      family: 'MAJOR',
      majorIndex: 2,
    },
  ],
};

const NOTICE_LABEL: Record<string, string> = {
  '1|MDC': 'MDC',
  '1|AEC': 'AEC',
  '1|SEC': 'SEC',
  '1|VAC': 'VAC',
  '1|MINOR': 'MINOR 100',
  '1|MAJOR|0': 'MAJOR 100',
  '3|AEC': 'AEC',
  '3|MDC': 'MDC',
  '3|SEC': 'SEC',
  '3|MAJOR|0': 'MAJOR 200',
  '3|MAJOR|1': 'MAJOR 201',
  '5|MINOR': 'MINOR 302',
  '5|MAJOR|0': 'MAJOR 300',
  '5|MAJOR|1': 'MAJOR 301',
  '5|MAJOR|2': 'MAJOR 302',
};

function slotLabel(semesterNo: number, slot: Slot): string {
  const key =
    slot.family === 'MAJOR'
      ? `${semesterNo}|MAJOR|${slot.majorIndex ?? 0}`
      : `${semesterNo}|${slot.family}`;
  return NOTICE_LABEL[key] ?? slot.family;
}

export function assignFyugpSecondIaTimetable(
  papers: FyugpPaperLike[],
  pattern: FyugpRoutinePattern = 'DAY',
): {
  assignments: FyugpAssignment[];
  warnings: string[];
  maxDayOffset: number;
} {
  const assignments: FyugpAssignment[] = [];
  const warnings: string[] = [];
  if (pattern === 'MORNING') {
    warnings.push(
      'The printed 2nd Internal Assessment routine is the Day Shift. Morning times are not on that notice.',
    );
  }

  const bySem = new Map<number, FyugpPaperLike[]>();
  for (const paper of papers) {
    const sem = paper.semesterNo ?? 0;
    if (!sem) {
      warnings.push(
        `${paper.paperCode}: missing semester — left on existing date`,
      );
      continue;
    }
    if (!bySem.has(sem)) bySem.set(sem, []);
    bySem.get(sem)!.push(paper);
  }

  let maxDayOffset = 0;

  for (const [semesterNo, semPapers] of bySem) {
    const slots = DAY_SLOTS[semesterNo];
    if (!slots) {
      for (const paper of semPapers) {
        warnings.push(
          `${paper.paperCode} (Sem ${semesterNo}): no 2nd IA day on the printed routine — left unchanged`,
        );
      }
      continue;
    }

    const majors = semPapers.filter(
      (p) => normalizeFyugpCategory(p.category) === 'MAJOR',
    );
    const majorsByGroup = new Map<string, FyugpPaperLike[]>();
    for (const paper of majors) {
      const key = majorGroupKey(paper);
      if (!majorsByGroup.has(key)) majorsByGroup.set(key, []);
      majorsByGroup.get(key)!.push(paper);
    }
    const majorIndexById = new Map<string, number>();
    for (const group of majorsByGroup.values()) {
      const codes = [...new Set(group.map((paper) => paper.paperCode))].sort(
        (a, b) => a.localeCompare(b),
      );
      const indexByCode = new Map(codes.map((code, index) => [code, index]));
      for (const paper of group) {
        majorIndexById.set(paper.id, indexByCode.get(paper.paperCode) ?? 0);
      }
    }

    const used = new Set<string>();
    for (const slot of slots) {
      const candidates = semPapers.filter((paper) => {
        if (used.has(paper.id)) return false;
        const family = normalizeFyugpCategory(paper.category);
        if (family !== slot.family) return false;
        if (slot.family === 'MAJOR') {
          return majorIndexById.get(paper.id) === slot.majorIndex;
        }
        return true;
      });
      if (!candidates.length) continue;
      maxDayOffset = Math.max(maxDayOffset, slot.dayOffset);
      for (const paper of candidates) {
        used.add(paper.id);
        assignments.push({
          paperId: paper.id,
          dayOffset: slot.dayOffset,
          startTime: slot.startTime,
          endTime: slot.endTime,
          label: slotLabel(semesterNo, slot),
        });
      }
    }

    for (const paper of semPapers) {
      if (used.has(paper.id)) continue;
      const family = normalizeFyugpCategory(paper.category);
      warnings.push(
        `${paper.paperCode} (Sem ${semesterNo}, ${family ?? paper.category ?? 'unknown'}): no matching 2nd IA slot — left unchanged`,
      );
    }
  }

  return { assignments, warnings, maxDayOffset };
}

export type SecondIaNoticeRow = {
  slNo: number;
  dateLabel: string;
  dayLabel: string;
  timingLabel: string;
  sem1: string;
  sem3: string;
  sem5: string;
};

function formatDate(d: Date) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

/** Printed Day Shift grid. Tuesday is two rows: morning AEC, then afternoon. */
export function buildFyugpSecondIaDayNotice(
  startDateIso: string,
): SecondIaNoticeRow[] {
  const [y, m, d] = startDateIso.split('-').map(Number);
  if (!y || !m || !d) return [];
  const day = (offset: number) => new Date(y, m - 1, d + offset);
  const dateOf = (offset: number) => formatDate(day(offset));
  const nameOf = (offset: number) =>
    day(offset).toLocaleDateString('en-IN', { weekday: 'long' }).toUpperCase();

  const afternoon = 'AFTERNOON 1:00-2:15';
  const blank = '--------';
  const lines: Array<Omit<SecondIaNoticeRow, 'slNo'>> = [
    {
      dateLabel: dateOf(0),
      dayLabel: nameOf(0),
      timingLabel: afternoon,
      sem1: 'MDC',
      sem3: 'AEC',
      sem5: 'MINOR 302',
    },
    {
      dateLabel: dateOf(1),
      dayLabel: nameOf(1),
      timingLabel: 'MORNING 9:45-11:00',
      sem1: 'AEC',
      sem3: blank,
      sem5: blank,
    },
    {
      dateLabel: dateOf(1),
      dayLabel: nameOf(1),
      timingLabel: afternoon,
      sem1: 'SEC',
      sem3: 'MDC',
      sem5: blank,
    },
    {
      dateLabel: dateOf(2),
      dayLabel: nameOf(2),
      timingLabel: afternoon,
      sem1: 'VAC',
      sem3: 'SEC',
      sem5: 'MAJOR 300',
    },
    {
      dateLabel: dateOf(3),
      dayLabel: nameOf(3),
      timingLabel: afternoon,
      sem1: 'MINOR 100',
      sem3: 'MAJOR 200',
      sem5: 'MAJOR 301',
    },
    {
      dateLabel: dateOf(4),
      dayLabel: nameOf(4),
      timingLabel: afternoon,
      sem1: 'MAJOR 100',
      sem3: 'MAJOR 201',
      sem5: 'MAJOR 302',
    },
  ];
  return lines.map((row, index) => ({ slNo: index + 1, ...row }));
}

export const FYUGP_SECOND_IA_MARKS = 15;
export const FYUGP_SECOND_IA_INSTRUCTIONS = [
  'The Admit Card will be issued from 8th October 2026. Kindly, bring your fee book.',
  'Syllabus for the test: Classes taken after the 1st Internal Assessment to till date.',
  'Total marks-15 and the Duration of Exam: 1 hour 15 minutes.',
  'NEHU Question pattern to be followed.',
];
