export const DIRECTORY_COLUMN_KEY = 'directory-visible-columns';

export type DirectoryColumnId =
  | 'student'
  | 'roll'
  | 'nehu'
  | 'programme'
  | 'major'
  | 'semester'
  | 'shift'
  | 'contact'
  | 'abc'
  | 'fee'
  | 'attendance'
  | 'status'
  | 'actions';

export const DIRECTORY_COLUMNS: { id: DirectoryColumnId; label: string; locked?: boolean }[] = [
  { id: 'student', label: 'Student', locked: true },
  { id: 'roll', label: 'Roll No' },
  { id: 'nehu', label: 'NEHU Roll No' },
  { id: 'programme', label: 'Programme' },
  { id: 'major', label: 'Major' },
  { id: 'semester', label: 'Semester' },
  { id: 'shift', label: 'Shift' },
  { id: 'contact', label: 'Mobile' },
  { id: 'abc', label: 'ABC ID' },
  { id: 'fee', label: 'Fee Status' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'status', label: 'Status' },
  { id: 'actions', label: 'Actions', locked: true },
];

export const DEFAULT_DIRECTORY_COLUMNS: DirectoryColumnId[] = [
  'student',
  'roll',
  'nehu',
  'programme',
  'semester',
  'shift',
  'contact',
  'fee',
  'attendance',
  'status',
  'actions',
];

export function readStoredColumns(): DirectoryColumnId[] {
  if (typeof window === 'undefined') return DEFAULT_DIRECTORY_COLUMNS;
  try {
    const raw = JSON.parse(localStorage.getItem(DIRECTORY_COLUMN_KEY) ?? 'null') as unknown;
    if (!Array.isArray(raw)) return DEFAULT_DIRECTORY_COLUMNS;
    const allowed = new Set(DIRECTORY_COLUMNS.map((c) => c.id));
    const picked = raw.filter((id): id is DirectoryColumnId =>
      allowed.has(id as DirectoryColumnId),
    );
    const withLocked = DIRECTORY_COLUMNS.map((c) => c.id).filter(
      (id) => DIRECTORY_COLUMNS.find((c) => c.id === id)?.locked || picked.includes(id),
    );
    return withLocked.length > 0 ? withLocked : DEFAULT_DIRECTORY_COLUMNS;
  } catch {
    return DEFAULT_DIRECTORY_COLUMNS;
  }
}

export function writeStoredColumns(columns: DirectoryColumnId[]) {
  localStorage.setItem(DIRECTORY_COLUMN_KEY, JSON.stringify(columns));
}
