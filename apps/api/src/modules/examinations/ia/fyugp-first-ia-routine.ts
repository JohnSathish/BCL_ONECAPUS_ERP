/**
 * FYUGP First Internal Assessment printed routine.
 * Relative day 0 = startDate (typically Monday of the IA week).
 */

export type FyugpRoutinePattern = 'MORNING' | 'DAY';

export type FyugpTimeSlot = {
  dayOffset: number;
  startTime: string;
  endTime: string;
};

export type FyugpPaperLike = {
  id: string;
  paperCode: string;
  semesterNo: number | null;
  category?: string | null;
  /** Used to rank majors within a programme (ECO-200/201 share BA-ECO). */
  programmeCode?: string | null;
};

/** Group key so each dept's 1st/2nd major share the same IA day. */
export function majorGroupKey(paper: FyugpPaperLike): string {
  // Prefer subject stem (EDN-200 / ECO-200) so multi-track programmes (EDN vs EDU) stay separate.
  const m = paper.paperCode
    .trim()
    .toUpperCase()
    .match(/^([A-Z]+)/);
  if (m) return `C:${m[1]}`;
  const prog = paper.programmeCode?.trim();
  if (prog) return `P:${prog.toUpperCase()}`;
  return `I:${paper.id}`;
}

export type FyugpAssignment = {
  paperId: string;
  dayOffset: number;
  startTime: string;
  endTime: string;
  label: string;
};

const FAMILY = {
  MAJOR: 'MAJOR',
  MINOR: 'MINOR',
  AEC: 'AEC',
  MDC: 'MDC',
  SEC: 'SEC',
  VAC: 'VAC',
} as const;

type Family = (typeof FAMILY)[keyof typeof FAMILY];

/** Sem → relative day → family (+ major ordinal for MAJOR family). */
type DayTarget =
  | { family: Exclude<Family, 'MAJOR'> }
  | { family: 'MAJOR'; majorIndex: number };

const SEM_DAY_PLAN: Record<number, Record<number, DayTarget>> = {
  1: {
    0: { family: 'MAJOR', majorIndex: 0 },
    1: { family: 'MINOR' },
    2: { family: 'AEC' },
    3: { family: 'MDC' },
    4: { family: 'SEC' },
    5: { family: 'VAC' },
  },
  3: {
    0: { family: 'MAJOR', majorIndex: 0 },
    1: { family: 'MAJOR', majorIndex: 1 },
    2: { family: 'AEC' },
    3: { family: 'MDC' },
    4: { family: 'SEC' },
  },
  5: {
    0: { family: 'MAJOR', majorIndex: 0 },
    1: { family: 'MAJOR', majorIndex: 1 },
    2: { family: 'MAJOR', majorIndex: 2 },
    3: { family: 'MAJOR', majorIndex: 3 },
    4: { family: 'MINOR' },
  },
};

export function normalizeFyugpCategory(raw?: string | null): Family | null {
  if (!raw?.trim()) return null;
  const cat = raw
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (cat === 'MAJOR' || cat.startsWith('MAJOR_') || cat.startsWith('MAJOR')) {
    return FAMILY.MAJOR;
  }
  if (cat === 'MINOR' || cat.startsWith('MINOR')) return FAMILY.MINOR;
  if (cat === 'AEC' || cat.startsWith('AEC')) return FAMILY.AEC;
  if (cat === 'MDC' || cat.startsWith('MDC')) return FAMILY.MDC;
  if (cat === 'SEC' || cat.startsWith('SEC')) return FAMILY.SEC;
  if (cat === 'VAC' || cat.startsWith('VAC')) return FAMILY.VAC;
  return null;
}

export function inferFyugpRoutinePattern(
  shiftName?: string | null,
): FyugpRoutinePattern {
  const name = (shiftName ?? '').toLowerCase();
  if (name.includes('morning')) return 'MORNING';
  if (name.includes('day')) return 'DAY';
  return 'DAY';
}

function slotFor(
  pattern: FyugpRoutinePattern,
  dayOffset: number,
  isVacAfternoon: boolean,
): FyugpTimeSlot {
  if (pattern === 'MORNING') {
    return { dayOffset, startTime: '07:15', endTime: '08:00' };
  }
  if (isVacAfternoon) {
    return { dayOffset, startTime: '13:45', endTime: '14:10' };
  }
  return { dayOffset, startTime: '09:45', endTime: '10:40' };
}

/**
 * Resolve the relative day + times for a paper target under a pattern.
 * Day-shift VAC uses Friday afternoon (day 4) instead of Saturday (day 5).
 */
export function resolveFyugpSlot(
  pattern: FyugpRoutinePattern,
  semesterNo: number,
  target: DayTarget,
): FyugpTimeSlot | null {
  const plan = SEM_DAY_PLAN[semesterNo];
  if (!plan) return null;

  for (const [dayStr, dayTarget] of Object.entries(plan)) {
    const dayOffset = Number(dayStr);
    const matches =
      dayTarget.family === target.family &&
      (target.family !== 'MAJOR' ||
        ('majorIndex' in dayTarget &&
          dayTarget.majorIndex === target.majorIndex));
    if (!matches) continue;

    if (target.family === 'VAC' && pattern === 'DAY') {
      // Printed Day Shift: Sem 1 VAC on Friday afternoon (same day as SEC).
      return slotFor('DAY', 4, true);
    }
    if (target.family === 'VAC' && pattern === 'MORNING') {
      return slotFor('MORNING', dayOffset, false);
    }
    return slotFor(pattern, dayOffset, false);
  }
  return null;
}

export function assignFyugpFirstIaTimetable(
  papers: FyugpPaperLike[],
  pattern: FyugpRoutinePattern,
): {
  assignments: FyugpAssignment[];
  warnings: string[];
  maxDayOffset: number;
} {
  const assignments: FyugpAssignment[] = [];
  const warnings: string[] = [];
  let maxDayOffset = 0;

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

  for (const [semesterNo, semPapers] of bySem) {
    const plan = SEM_DAY_PLAN[semesterNo];
    if (!plan) {
      for (const p of semPapers) {
        warnings.push(
          `${p.paperCode} (Sem ${semesterNo}): no FYUGP First-IA day plan — left unchanged`,
        );
      }
      continue;
    }

    // Rank majors per programme/dept so every dept's MAJOR 1 shares Mon, etc.
    const majors = semPapers.filter(
      (p) => normalizeFyugpCategory(p.category) === 'MAJOR',
    );
    const majorsByGroup = new Map<string, FyugpPaperLike[]>();
    for (const p of majors) {
      const key = majorGroupKey(p);
      if (!majorsByGroup.has(key)) majorsByGroup.set(key, []);
      majorsByGroup.get(key)!.push(p);
    }
    const majorIndexById = new Map<string, number>();
    for (const group of majorsByGroup.values()) {
      group
        .slice()
        .sort((a, b) => a.paperCode.localeCompare(b.paperCode))
        .forEach((p, index) => majorIndexById.set(p.id, index));
    }

    const used = new Set<string>();

    for (const [dayStr, target] of Object.entries(plan)) {
      const dayOffset = Number(dayStr);
      let candidates = semPapers.filter((p) => {
        if (used.has(p.id)) return false;
        const family = normalizeFyugpCategory(p.category);
        if (family !== target.family) return false;
        if (target.family === 'MAJOR') {
          return majorIndexById.get(p.id) === target.majorIndex;
        }
        return true;
      });

      // Electives: multiple offerings share a category (AEC/MDC/SEC/VAC/MINOR).
      // Schedule every unmatched paper of that family on the same day/slot.
      if (target.family !== 'MAJOR') {
        candidates = semPapers.filter((p) => {
          if (used.has(p.id)) return false;
          return normalizeFyugpCategory(p.category) === target.family;
        });
      }

      if (!candidates.length) continue;

      const isVacAfternoon = target.family === 'VAC' && pattern === 'DAY';
      const resolvedDay =
        target.family === 'VAC' && pattern === 'DAY' ? 4 : dayOffset;
      const slot = slotFor(pattern, resolvedDay, isVacAfternoon);
      maxDayOffset = Math.max(maxDayOffset, slot.dayOffset);

      for (const paper of candidates) {
        used.add(paper.id);
        const label =
          target.family === 'MAJOR'
            ? `MAJOR ${target.majorIndex + 1}`
            : target.family;
        assignments.push({
          paperId: paper.id,
          dayOffset: slot.dayOffset,
          startTime: slot.startTime,
          endTime: slot.endTime,
          label,
        });
      }
    }

    for (const paper of semPapers) {
      if (used.has(paper.id)) continue;
      const family = normalizeFyugpCategory(paper.category);
      warnings.push(
        `${paper.paperCode} (Sem ${semesterNo}, ${family ?? paper.category ?? 'unknown'}): no matching FYUGP First-IA slot — left unchanged`,
      );
    }
  }

  return { assignments, warnings, maxDayOffset };
}

/** Exported for unit tests. */
export const FYUGP_FIRST_IA_SEM_DAY_PLAN = SEM_DAY_PLAN;
