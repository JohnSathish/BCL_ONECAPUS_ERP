export const STAFF_COLUMN_KEY = 'staff-directory-visible-columns';

export type StaffColumnId =
  | 'staff'
  | 'code'
  | 'type'
  | 'department'
  | 'designation'
  | 'quarter'
  | 'shift'
  | 'portal'
  | 'rfid'
  | 'timetable'
  | 'subjects'
  | 'status'
  | 'joined'
  | 'actions';

export const STAFF_COLUMNS: { id: StaffColumnId; label: string; locked?: boolean }[] = [
  { id: 'staff', label: 'Staff', locked: true },
  { id: 'code', label: 'Code' },
  { id: 'type', label: 'Type' },
  { id: 'department', label: 'Department' },
  { id: 'designation', label: 'Designation' },
  { id: 'quarter', label: 'Quarter' },
  { id: 'shift', label: 'Shift' },
  { id: 'portal', label: 'Portal' },
  { id: 'rfid', label: 'RFID' },
  { id: 'timetable', label: 'Timetable' },
  { id: 'subjects', label: 'Subjects' },
  { id: 'status', label: 'Status' },
  { id: 'joined', label: 'Joined' },
  { id: 'actions', label: 'Actions', locked: true },
];

export const DEFAULT_STAFF_COLUMNS: StaffColumnId[] = [
  'staff',
  'code',
  'type',
  'department',
  'designation',
  'shift',
  'portal',
  'rfid',
  'timetable',
  'status',
  'joined',
  'actions',
];

export function readStoredStaffColumns(): StaffColumnId[] {
  if (typeof window === 'undefined') return DEFAULT_STAFF_COLUMNS;
  try {
    const raw = JSON.parse(localStorage.getItem(STAFF_COLUMN_KEY) ?? 'null') as unknown;
    if (!Array.isArray(raw)) return DEFAULT_STAFF_COLUMNS;
    const allowed = new Set(STAFF_COLUMNS.map((column) => column.id));
    const picked = raw.filter((id): id is StaffColumnId => allowed.has(id as StaffColumnId));
    const stored = STAFF_COLUMNS.map((column) => column.id).filter(
      (id) => columnLocked(id) || picked.includes(id),
    );
    return stored.length > 0 ? stored : DEFAULT_STAFF_COLUMNS;
  } catch {
    return DEFAULT_STAFF_COLUMNS;
  }
}

function columnLocked(id: StaffColumnId) {
  return STAFF_COLUMNS.find((column) => column.id === id)?.locked === true;
}

export function writeStoredStaffColumns(columns: StaffColumnId[]) {
  localStorage.setItem(STAFF_COLUMN_KEY, JSON.stringify(columns));
}
