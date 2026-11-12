import { addStatus, emptyFold } from './attendance-report.util';

export type MonthColumn = { key: string; label: string };

export type MonthWiseMark = {
  studentId: string;
  monthKey: string;
  classKey: string;
  status: string;
};

export type AttendanceTone = 'red' | 'light-red' | 'orange' | 'green' | 'muted';

export type PercentageFilter = {
  /** Lower bound. Null means no minimum. */
  min?: number | null;
  /** Upper bound. Null means no maximum. */
  max?: number | null;
  minInclusive?: boolean;
  maxInclusive?: boolean;
};

export type MonthWiseCell = {
  key: string;
  label: string;
  conducted: number;
  attended: number;
  absent: number;
  leave: number;
  duty: number;
  percentage: number | null;
  display: string;
  tone: AttendanceTone;
};

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function listMonthColumns(
  fromMonth: string,
  toMonth: string,
): MonthColumn[] {
  if (!MONTH_PATTERN.test(fromMonth) || !MONTH_PATTERN.test(toMonth)) {
    throw new Error('Choose a from month and a to month.');
  }
  if (fromMonth > toMonth) {
    throw new Error('From month must not be after to month.');
  }
  const [fromYear, fromMonthNo] = fromMonth.split('-').map(Number);
  const [toYear, toMonthNo] = toMonth.split('-').map(Number);
  const columns: MonthColumn[] = [];
  let year = fromYear;
  let month = fromMonthNo;
  while (year < toYear || (year === toYear && month <= toMonthNo)) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    const label = new Date(Date.UTC(year, month - 1, 1)).toLocaleString(
      'en-IN',
      {
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      },
    );
    columns.push({ key, label });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    if (columns.length > 12) {
      throw new Error('Choose a range of 12 months or fewer.');
    }
  }
  return columns;
}

/** Inclusive UTC bounds for a YYYY-MM range. `to` is midnight on the last day. */
export function monthRangeBounds(fromMonth: string, toMonth: string) {
  const columns = listMonthColumns(fromMonth, toMonth);
  const [fromYear, fromMonthNo] = columns[0].key.split('-').map(Number);
  const last = columns[columns.length - 1].key;
  const [toYear, toMonthNo] = last.split('-').map(Number);
  return {
    from: new Date(Date.UTC(fromYear, fromMonthNo - 1, 1)),
    to: new Date(Date.UTC(toYear, toMonthNo, 0)),
    columns,
  };
}

export function formatAttendancePercent(value: number) {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(2)}%`;
}

export function attendanceTone(percentage: number | null): AttendanceTone {
  if (percentage == null || Number.isNaN(percentage)) return 'muted';
  if (percentage < 50) return 'red';
  if (percentage < 60) return 'light-red';
  if (percentage < 75) return 'orange';
  return 'green';
}

/**
 * Compare the raw percentage. "Below 60" is strictly less than 60, so a
 * student at 59.996 is included and a student at 60 is not.
 */
export function matchesOverallPercentage(
  percentage: number | null,
  filter?: PercentageFilter | null,
) {
  if (!filter || (filter.min == null && filter.max == null)) return true;
  if (percentage == null || Number.isNaN(percentage)) return false;
  if (filter.min != null) {
    const belowMin = filter.minInclusive
      ? percentage < filter.min
      : percentage <= filter.min;
    if (belowMin) return false;
  }
  if (filter.max != null) {
    const aboveMax = filter.maxInclusive
      ? percentage > filter.max
      : percentage >= filter.max;
    if (aboveMax) return false;
  }
  return true;
}

export function percentageFilterForBand(
  band: string,
  customMin?: number | null,
  customMax?: number | null,
): PercentageFilter {
  if (band === 'below-50') return { max: 50, maxInclusive: false };
  if (band === 'below-60') return { max: 60, maxInclusive: false };
  if (band === 'below-65') return { max: 65, maxInclusive: false };
  if (band === 'below-70') return { max: 70, maxInclusive: false };
  if (band === 'below-75') return { max: 75, maxInclusive: false };
  if (band === 'below-80') return { max: 80, maxInclusive: false };
  if (band === 'above-75') return { min: 75, minInclusive: false };
  if (band === 'above-80') return { min: 80, minInclusive: false };
  if (band === 'at-least-75') return { min: 75, minInclusive: true };
  if (band === 'custom') {
    return {
      min: customMin ?? null,
      max: customMax ?? null,
      minInclusive: true,
      maxInclusive: true,
    };
  }
  return {};
}

export function attendanceBandCounts(percentages: Array<number | null>) {
  const counts = {
    students: percentages.length,
    below50: 0,
    below60: 0,
    below75: 0,
    atLeast75: 0,
    unmarked: 0,
  };
  for (const percentage of percentages) {
    if (percentage == null || Number.isNaN(percentage)) {
      counts.unmarked += 1;
      continue;
    }
    if (percentage < 50) counts.below50 += 1;
    if (percentage < 60) counts.below60 += 1;
    if (percentage < 75) counts.below75 += 1;
    if (percentage >= 75) counts.atLeast75 += 1;
  }
  return counts;
}

export function formatAttendanceCell(attended: number, conducted: number) {
  if (conducted <= 0) return 'N/A';
  const percentage = (attended / conducted) * 100;
  return `${attended}/${conducted} (${formatAttendancePercent(percentage)})`;
}

function cellFromFold(
  key: string,
  label: string,
  fold: ReturnType<typeof emptyFold>,
): MonthWiseCell {
  const conducted = fold.conducted - fold.exempted;
  const attended = fold.countedPresent;
  const percentage = conducted > 0 ? (attended / conducted) * 100 : null;
  return {
    key,
    label,
    conducted,
    attended,
    absent: fold.absent,
    leave: fold.leave,
    duty: fold.duty,
    percentage,
    display: formatAttendanceCell(attended, conducted),
    tone: attendanceTone(percentage),
  };
}

/**
 * One row per student. A month with no marked class for that student is N/A
 * and is left out of the overall total. Overall uses attended ÷ conducted,
 * not the average of the monthly percentages.
 */
export function summarizeMonthWise(input: {
  months: MonthColumn[];
  marks: MonthWiseMark[];
  conductedKeys: Array<{ monthKey: string; classKey: string }>;
}) {
  const conductedByMonth = new Map<string, Set<string>>();
  for (const column of input.months)
    conductedByMonth.set(column.key, new Set());
  for (const item of input.conductedKeys) {
    conductedByMonth.get(item.monthKey)?.add(item.classKey);
  }

  const byStudent = new Map<string, Map<string, MonthWiseMark>>();
  for (const mark of input.marks) {
    if (!input.months.some((column) => column.key === mark.monthKey)) continue;
    const months =
      byStudent.get(mark.studentId) ?? new Map<string, MonthWiseMark>();
    const dedupeKey = `${mark.monthKey}|${mark.classKey}`;
    if (!months.has(dedupeKey)) months.set(dedupeKey, mark);
    byStudent.set(mark.studentId, months);
  }

  const monthSummaries = input.months.map((column) => ({
    key: column.key,
    label: column.label,
    conducted: conductedByMonth.get(column.key)?.size ?? 0,
  }));

  const rows = [...byStudent.entries()].map(([studentId, marks]) => {
    const months = input.months.map((column) => {
      const fold = emptyFold();
      for (const mark of marks.values()) {
        if (mark.monthKey !== column.key) continue;
        addStatus(fold, mark.status);
      }
      return cellFromFold(column.key, column.label, fold);
    });
    const overallFold = emptyFold();
    for (const mark of marks.values()) addStatus(overallFold, mark.status);
    const overall = cellFromFold('overall', 'Overall', overallFold);
    return { studentId, months, overall };
  });

  const totalConducted = monthSummaries.reduce(
    (sum, month) => sum + month.conducted,
    0,
  );
  return { months: monthSummaries, totalConducted, rows };
}
