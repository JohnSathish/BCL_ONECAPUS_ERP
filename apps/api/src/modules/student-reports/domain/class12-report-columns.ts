export type Class12MarkEntry = {
  display: string;
  marks: number | null;
  sortOrder: number;
};

export type Class12MarksBySubject = Record<string, Class12MarkEntry>;

export const CLASS12_MARKS_ROW_KEY = 'class12MarksBySubject';
export const CLASS12_LIST_COLUMN = 'class12SubjectList';

/** Match "Garo (MIL)" with "Garo(MIL)" and ignore letter case. */
export function class12SubjectMatchKey(name: string) {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*\(\s*/g, '(')
    .replace(/\s*\)\s*/g, ')')
    .toLowerCase();
}

export function class12SubjectDisplayName(name: string) {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*\(\s*/g, ' (')
    .replace(/\s*\)\s*/g, ')');
}

/**
 * Replace the single "Class XII Subjects and Marks" column with one numeric
 * column per subject found on the exported students.
 */
export function expandClass12SubjectColumns<
  T extends { key: string; label: string },
>(
  columns: T[],
  rows: Record<string, unknown>[],
): { columns: T[]; rows: Record<string, unknown>[] } {
  const index = columns.findIndex(
    (column) => column.key === CLASS12_LIST_COLUMN,
  );
  if (index < 0) return { columns, rows };

  const subjects = new Map<string, { label: string; sortOrder: number }>();
  for (const row of rows) {
    const marks = readMarks(row[CLASS12_MARKS_ROW_KEY]);
    for (const [key, entry] of Object.entries(marks)) {
      const current = subjects.get(key);
      if (!current || entry.sortOrder < current.sortOrder) {
        subjects.set(key, { label: entry.display, sortOrder: entry.sortOrder });
      }
    }
  }

  const ordered = [...subjects.entries()].sort((left, right) => {
    if (left[1].sortOrder !== right[1].sortOrder) {
      return left[1].sortOrder - right[1].sortOrder;
    }
    return left[1].label.localeCompare(right[1].label, undefined, {
      sensitivity: 'base',
    });
  });

  const subjectColumns = ordered.map(([key, subject]) => ({
    key: `class12mark:${key}`,
    label: subject.label,
    align: 'right' as const,
  })) as T[];

  const nextColumns = [
    ...columns.slice(0, index),
    ...subjectColumns,
    ...columns.slice(index + 1),
  ];

  const nextRows = rows.map((row) => {
    const marks = readMarks(row[CLASS12_MARKS_ROW_KEY]);
    const next: Record<string, unknown> = { ...row };
    delete next[CLASS12_LIST_COLUMN];
    delete next[CLASS12_MARKS_ROW_KEY];
    for (const [key] of ordered) {
      const marksValue = marks[key]?.marks;
      next[`class12mark:${key}`] =
        typeof marksValue === 'number' ? marksValue : '';
    }
    return next;
  });

  return { columns: nextColumns, rows: nextRows };
}

function readMarks(value: unknown): Class12MarksBySubject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Class12MarksBySubject;
}
