export const UNASSIGNED_DEPARTMENT_ID = 'unassigned';

export const INSTALLATION_BASIS =
  'A person is Installed only when the Don Bosco College mobile app has an active device registration with a valid FCM or APNs token. A website login is not an installation. Each person is counted once, even with several devices. A repeated token is credited to the most recently seen registration only. A device record with a missing or invalid token is Unverified.';

const INACTIVE_STUDENT_STATUSES = [
  'ALUMNI',
  'GRADUATED',
  'PASSED_OUT',
  'PASSED OUT',
  'LEFT',
  'TRANSFERRED',
  'INACTIVE',
  'DROPPED',
  'DISCONTINUED',
  'CANCELLED',
  'WITHDRAWN',
] as const;

const INACTIVE_LIFECYCLES = [
  'GRADUATED',
  'ALUMNI',
  'LEFT',
  'TRANSFERRED',
  'WITHDRAWN',
  'INACTIVE',
  'COMPLETED',
  'EXITED',
] as const;

const INACTIVE_PROGRAMMES = [
  'COMPLETED',
  'GRADUATED',
  'ALUMNI',
  'WITHDRAWN',
] as const;

export const inactiveStudentStatuses = [...INACTIVE_STUDENT_STATUSES];
export const inactiveLifecycles = [...INACTIVE_LIFECYCLES];
export const inactiveProgrammes = [...INACTIVE_PROGRAMMES];

export type InstallStatus = 'INSTALLED' | 'NOT_INSTALLED' | 'UNVERIFIED';
export type ShiftBucket = 'MORNING' | 'DAY' | 'EVENING' | 'OTHER';
export type StaffReportCategory = 'TEACHING' | 'NON_TEACHING';

export type DeviceSignal = {
  userId: string;
  status: string;
  pushToken: string | null;
  lastSeenAt: string;
};

export type InstallSignal = {
  status: InstallStatus;
  lastActiveAt: string | null;
};

export type InstallationPerson = {
  id: string;
  userId: string | null;
  category: 'STUDENT' | StaffReportCategory;
  categoryLabel: string;
  name: string;
  identifier: string;
  roleLabel: string;
  email: string | null;
  mobile: string | null;
  departmentId: string;
  departmentName: string;
  shiftLabel: string;
  semester: number | null;
  status: InstallStatus;
  lastLoginAt: string | null;
  lastActiveAt: string | null;
  serial: number;
};

export type DepartmentExtreme = {
  id: string;
  name: string;
  percent: number;
  total: number;
};

export type InstallationSummary = {
  total: number;
  installed: number;
  notInstalled: number;
  unverified: number;
  percent: number;
  highest: DepartmentExtreme | null;
  lowest: DepartmentExtreme | null;
};

export type InstallationDepartment = {
  id: string;
  serial: number;
  name: string;
  total: number;
  installed: number;
  notInstalled: number;
  unverified: number;
  percent: number;
  people: InstallationPerson[];
  followUp: InstallationPerson[];
};

const PLACEHOLDERS = new Set([
  'null',
  'undefined',
  'none',
  'nil',
  'test',
  'invalid',
  'placeholder',
  'na',
  'n/a',
  '-',
]);

/** FCM registration tokens and 64-character APNs device tokens. Expo tokens are not deliverable. */
export function isValidPushToken(token: string | null | undefined): boolean {
  if (!token) return false;
  const value = token.trim();
  if (!value || PLACEHOLDERS.has(value.toLowerCase())) return false;
  if (/^exponentpushtoken\[/i.test(value) || /^expopushtoken\[/i.test(value)) {
    return false;
  }
  if (/^[0-9a-f]{64}$/i.test(value)) return true;
  return value.length >= 40 && /^[A-Za-z0-9:_\-.]+$/.test(value);
}

export function tokenKey(token: string): string {
  const trimmed = token.trim();
  if (/^[0-9a-f]{64}$/i.test(trimmed)) return trimmed.toLowerCase();
  return trimmed;
}

function latestSeen(rows: DeviceSignal[]): string | null {
  let best: { iso: string; time: number } | null = null;
  for (const row of rows) {
    const time = Date.parse(row.lastSeenAt);
    if (Number.isNaN(time)) continue;
    if (!best || time >= best.time)
      best = { iso: new Date(time).toISOString(), time };
  }
  return best?.iso ?? null;
}

/**
 * Classify college-app device rows. Callers treat a user who is absent from the
 * result as Not Installed. This function never reads website login timestamps.
 */
export function classifyInstallations(
  devices: DeviceSignal[],
): Map<string, InstallSignal> {
  const byUser = new Map<string, DeviceSignal[]>();
  for (const device of devices) {
    const list = byUser.get(device.userId) ?? [];
    list.push(device);
    byUser.set(device.userId, list);
  }

  const tokenWinner = new Map<string, { userId: string; seen: number }>();
  for (const device of devices) {
    if (device.status.toUpperCase() !== 'ACTIVE') continue;
    if (!isValidPushToken(device.pushToken)) continue;
    const key = tokenKey(device.pushToken!.trim());
    const seen = Date.parse(device.lastSeenAt);
    if (Number.isNaN(seen)) continue;
    const current = tokenWinner.get(key);
    if (!current || seen >= current.seen) {
      tokenWinner.set(key, { userId: device.userId, seen });
    }
  }

  const result = new Map<string, InstallSignal>();
  for (const [userId, rows] of byUser) {
    const active = rows.filter((row) => row.status.toUpperCase() === 'ACTIVE');
    const ownsValidToken = active.some((row) => {
      if (!isValidPushToken(row.pushToken)) return false;
      const winner = tokenWinner.get(tokenKey(row.pushToken!.trim()));
      return winner?.userId === userId;
    });
    let status: InstallStatus = 'NOT_INSTALLED';
    if (ownsValidToken) status = 'INSTALLED';
    else if (active.length > 0) status = 'UNVERIFIED';
    result.set(userId, { status, lastActiveAt: latestSeen(rows) });
  }
  return result;
}

export function installationPercent(installed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((installed / total) * 1000) / 10;
}

export function shiftBucket(input: {
  name?: string | null;
  code?: string | null;
  category?: string | null;
}): ShiftBucket {
  const code = (input.code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (['E', 'EVE', 'EVENING', 'NIGHT'].includes(code)) return 'EVENING';
  if (['M', 'MOR', 'MORNING'].includes(code)) return 'MORNING';
  if (['D', 'DAY'].includes(code)) return 'DAY';
  const blob = `${input.category ?? ''} ${input.name ?? ''}`.toUpperCase();
  if (/\bEVENING\b|\bNIGHT\b/.test(blob)) return 'EVENING';
  if (/\bMORNING\b/.test(blob)) return 'MORNING';
  if (/\bDAY\b/.test(blob)) return 'DAY';
  return 'OTHER';
}

export function matchesShiftFilter(
  input: {
    name?: string | null;
    code?: string | null;
    category?: string | null;
  },
  filter?: string | null,
): boolean {
  if (!filter) return true;
  const wanted = filter.toUpperCase();
  if (!['MORNING', 'DAY', 'EVENING'].includes(wanted)) return true;
  if (shiftBucket(input) === wanted) return true;
  return (
    (input.category ?? '').toUpperCase() === 'BOTH' &&
    (wanted === 'MORNING' || wanted === 'DAY')
  );
}

export function staffReportCategory(
  staffType: string | null | undefined,
  designationCategory?: string | null,
): StaffReportCategory {
  const type = (staffType ?? '').toUpperCase();
  const designation = (designationCategory ?? '').toUpperCase();
  if (type === 'CONTRACT') {
    return designation === 'TEACHING' ? 'TEACHING' : 'NON_TEACHING';
  }
  if (type === 'NON_TEACHING' || type === 'ADMIN') return 'NON_TEACHING';
  if (type === 'TEACHING' || type === 'GUEST' || type === 'VISITING') {
    return 'TEACHING';
  }
  if (designation === 'NON_TEACHING' || designation === 'ADMIN') {
    return 'NON_TEACHING';
  }
  return 'TEACHING';
}

export function matchesPersonSearch(
  person: { name: string; identifier: string },
  search?: string | null,
): boolean {
  const query = search?.trim().toLowerCase();
  if (!query) return true;
  return `${person.name} ${person.identifier}`.toLowerCase().includes(query);
}

export function reportCollegeName(name: string | null | undefined): string {
  const trimmed = name?.trim() || '';
  if (!trimmed) return 'Don Bosco College, Tura';
  if (/don bosco/i.test(trimmed) && !/tura/i.test(trimmed)) {
    return 'Don Bosco College, Tura';
  }
  return trimmed;
}

export function reportHeadingName(name: string | null | undefined): string {
  return reportCollegeName(name).toUpperCase();
}

export function extremeDepartments(
  rows: Array<{ id: string; name: string; total: number; percent: number }>,
): { highest: DepartmentExtreme | null; lowest: DepartmentExtreme | null } {
  const eligible = rows.filter((row) => row.total > 0);
  if (!eligible.length) return { highest: null, lowest: null };
  const byHigh = [...eligible].sort((a, b) => {
    if (b.percent !== a.percent) return b.percent - a.percent;
    if (b.total !== a.total) return b.total - a.total;
    return a.name.localeCompare(b.name);
  });
  const byLow = [...eligible].sort((a, b) => {
    if (a.percent !== b.percent) return a.percent - b.percent;
    if (b.total !== a.total) return b.total - a.total;
    return a.name.localeCompare(b.name);
  });
  const pack = (row: (typeof eligible)[number]): DepartmentExtreme => ({
    id: row.id,
    name: row.name,
    percent: row.percent,
    total: row.total,
  });
  return { highest: pack(byHigh[0]), lowest: pack(byLow[0]) };
}

function summarize(departments: InstallationDepartment[]): InstallationSummary {
  const total = departments.reduce((sum, row) => sum + row.total, 0);
  const installed = departments.reduce((sum, row) => sum + row.installed, 0);
  const notInstalled = departments.reduce(
    (sum, row) => sum + row.notInstalled,
    0,
  );
  const unverified = departments.reduce((sum, row) => sum + row.unverified, 0);
  const extremes = extremeDepartments(departments);
  const summary = {
    total,
    installed,
    notInstalled,
    unverified,
    percent: installationPercent(installed, total),
    highest: extremes.highest,
    lowest: extremes.lowest,
  };
  const listed = departments.reduce((sum, row) => sum + row.people.length, 0);
  if (listed !== total || installed + notInstalled + unverified !== total) {
    throw new Error(
      'Installation report totals do not match the listed people',
    );
  }
  return summary;
}

export function groupInstallation(people: InstallationPerson[]): {
  departments: InstallationDepartment[];
  summary: InstallationSummary;
} {
  const buckets = new Map<string, InstallationPerson[]>();
  for (const person of people) {
    const list = buckets.get(person.departmentId) ?? [];
    list.push(person);
    buckets.set(person.departmentId, list);
  }
  const departments: InstallationDepartment[] = [];
  for (const [id, rows] of buckets) {
    const sorted = [...rows].sort(
      (a, b) =>
        a.name.localeCompare(b.name) ||
        a.identifier.localeCompare(b.identifier),
    );
    const numbered = sorted.map((row, index) => ({
      ...row,
      serial: index + 1,
    }));
    const installed = numbered.filter(
      (row) => row.status === 'INSTALLED',
    ).length;
    const notInstalled = numbered.filter(
      (row) => row.status === 'NOT_INSTALLED',
    ).length;
    const unverified = numbered.filter(
      (row) => row.status === 'UNVERIFIED',
    ).length;
    departments.push({
      id,
      serial: 0,
      name: numbered[0]?.departmentName || 'Unassigned',
      total: numbered.length,
      installed,
      notInstalled,
      unverified,
      percent: installationPercent(installed, numbered.length),
      people: numbered,
      followUp: [],
    });
  }
  departments.sort((a, b) => {
    if (a.id === UNASSIGNED_DEPARTMENT_ID) return 1;
    if (b.id === UNASSIGNED_DEPARTMENT_ID) return -1;
    return a.name.localeCompare(b.name);
  });
  departments.forEach((department, index) => {
    department.serial = index + 1;
  });
  return { departments, summary: summarize(departments) };
}

/** Full department totals, with name lists limited to people who are not installed. */
export function pendingInstallationView(people: InstallationPerson[]): {
  departments: InstallationDepartment[];
  summary: InstallationSummary;
} {
  const grouped = groupInstallation(people);
  for (const department of grouped.departments) {
    const pending = department.people
      .filter((person) => person.status === 'NOT_INSTALLED')
      .map((person, index) => ({ ...person, serial: index + 1 }));
    const followUp = department.people
      .filter((person) => person.status === 'UNVERIFIED')
      .map((person, index) => ({ ...person, serial: index + 1 }));
    department.people = pending;
    department.followUp = followUp;
  }
  return grouped;
}

export function formatReportTimestamp(value: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(value);
}
