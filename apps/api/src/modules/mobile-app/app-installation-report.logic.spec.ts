import {
  classifyInstallations,
  groupInstallation,
  installationPercent,
  isValidPushToken,
  matchesShiftFilter,
  pendingInstallationView,
  reportCollegeName,
  staffReportCategory,
} from './app-installation-report.logic';
import type { InstallationPerson } from './app-installation-report.logic';

const FCM = `fcm:${'A'.repeat(20)}:${'B'.repeat(40)}`;
const APNS = 'ab'.repeat(32);

function person(
  partial: Partial<InstallationPerson> &
    Pick<InstallationPerson, 'id' | 'status'>,
): InstallationPerson {
  return {
    userId: partial.id,
    category: 'STUDENT',
    categoryLabel: 'Student',
    name: partial.name ?? partial.id,
    identifier: partial.identifier ?? partial.id,
    roleLabel: 'Semester 1',
    email: null,
    mobile: null,
    departmentId: partial.departmentId ?? 'dept-a',
    departmentName: partial.departmentName ?? 'English',
    shiftLabel: 'Day',
    semester: 1,
    lastLoginAt: null,
    lastActiveAt: null,
    serial: 0,
    ...partial,
  };
}

describe('app installation classification', () => {
  it('accepts FCM and APNs tokens and rejects website-useless values', () => {
    expect(isValidPushToken(FCM)).toBe(true);
    expect(isValidPushToken(APNS)).toBe(true);
    expect(isValidPushToken(`ExponentPushToken[${'x'.repeat(22)}]`)).toBe(
      false,
    );
    expect(isValidPushToken('null')).toBe(false);
    expect(isValidPushToken('short-token')).toBe(false);
    expect(isValidPushToken(null)).toBe(false);
  });

  it('counts one person once when several devices share a valid token', () => {
    const classified = classifyInstallations([
      {
        userId: 'user-1',
        status: 'ACTIVE',
        pushToken: FCM,
        lastSeenAt: '2026-11-01T00:00:00.000Z',
      },
      {
        userId: 'user-1',
        status: 'ACTIVE',
        pushToken: FCM,
        lastSeenAt: '2026-11-02T00:00:00.000Z',
      },
    ]);
    expect(classified.size).toBe(1);
    expect(classified.get('user-1')?.status).toBe('INSTALLED');
    expect(classified.get('user-1')?.lastActiveAt).toBe(
      '2026-11-02T00:00:00.000Z',
    );
  });

  it('credits a duplicated token to the latest person and leaves the other unverified', () => {
    const classified = classifyInstallations([
      {
        userId: 'earlier',
        status: 'ACTIVE',
        pushToken: APNS,
        lastSeenAt: '2026-10-01T00:00:00.000Z',
      },
      {
        userId: 'later',
        status: 'ACTIVE',
        pushToken: APNS.toUpperCase(),
        lastSeenAt: '2026-11-01T00:00:00.000Z',
      },
    ]);
    expect(classified.get('later')?.status).toBe('INSTALLED');
    expect(classified.get('earlier')?.status).toBe('UNVERIFIED');
  });

  it('keeps a device without a usable token unverified', () => {
    const classified = classifyInstallations([
      {
        userId: 'user-2',
        status: 'ACTIVE',
        pushToken: null,
        lastSeenAt: '2026-11-03T00:00:00.000Z',
      },
    ]);
    expect(classified.get('user-2')?.status).toBe('UNVERIFIED');
  });

  it('does not treat a revoked registration as a current installation', () => {
    const classified = classifyInstallations([
      {
        userId: 'user-3',
        status: 'REVOKED',
        pushToken: null,
        lastSeenAt: '2026-08-01T00:00:00.000Z',
      },
    ]);
    expect(classified.get('user-3')?.status).toBe('NOT_INSTALLED');
    expect(classified.get('user-3')?.lastActiveAt).toBe(
      '2026-08-01T00:00:00.000Z',
    );
  });
});

describe('app installation rollup', () => {
  const rows = [
    person({
      id: 'a',
      name: 'Asha',
      status: 'INSTALLED',
      departmentId: 'eng',
      departmentName: 'English',
    }),
    person({
      id: 'b',
      name: 'Bina',
      status: 'NOT_INSTALLED',
      departmentId: 'eng',
      departmentName: 'English',
    }),
    person({
      id: 'c',
      name: 'Cara',
      status: 'UNVERIFIED',
      departmentId: 'his',
      departmentName: 'History',
    }),
  ];

  it('makes summary totals equal the people in each department', () => {
    const report = groupInstallation(rows);
    expect(report.summary.total).toBe(3);
    expect(report.summary.installed).toBe(1);
    expect(report.summary.notInstalled).toBe(1);
    expect(report.summary.unverified).toBe(1);
    expect(
      report.summary.installed +
        report.summary.notInstalled +
        report.summary.unverified,
    ).toBe(report.summary.total);
    expect(report.departments.reduce((sum, row) => sum + row.total, 0)).toBe(3);
    expect(report.summary.percent).toBe(installationPercent(1, 3));
    expect(report.summary.highest?.name).toBe('English');
    expect(report.summary.lowest?.name).toBe('History');
  });

  it('keeps department totals while listing only pending and unverified people', () => {
    const report = pendingInstallationView(rows);
    const english = report.departments.find((row) => row.name === 'English');
    expect(report.summary.installed).toBe(1);
    expect(english?.total).toBe(2);
    expect(english?.installed).toBe(1);
    expect(english?.people.map((row) => row.name)).toEqual(['Bina']);
    expect(
      report.departments.find((row) => row.name === 'History')?.followUp[0]
        ?.name,
    ).toBe('Cara');
  });
});

describe('staff and shift filters', () => {
  it('splits teaching and non-teaching staff', () => {
    expect(staffReportCategory('TEACHING', 'TEACHING')).toBe('TEACHING');
    expect(staffReportCategory('GUEST', null)).toBe('TEACHING');
    expect(staffReportCategory('NON_TEACHING', null)).toBe('NON_TEACHING');
    expect(staffReportCategory('ADMIN', null)).toBe('NON_TEACHING');
    expect(staffReportCategory('CONTRACT', 'NON_TEACHING')).toBe(
      'NON_TEACHING',
    );
    expect(staffReportCategory('CONTRACT', 'TEACHING')).toBe('TEACHING');
    expect(staffReportCategory('CONTRACT', null)).toBe('NON_TEACHING');
  });

  it('matches morning, day, and evening shifts, including staff who teach both', () => {
    expect(
      matchesShiftFilter({ name: 'Morning Shift', code: 'MOR' }, 'MORNING'),
    ).toBe(true);
    expect(matchesShiftFilter({ name: 'Day', code: 'D' }, 'DAY')).toBe(true);
    expect(matchesShiftFilter({ name: 'Evening', code: 'E' }, 'DAY')).toBe(
      false,
    );
    expect(
      matchesShiftFilter({ name: 'General', category: 'BOTH' }, 'MORNING'),
    ).toBe(true);
    expect(
      matchesShiftFilter({ name: 'General', category: 'BOTH' }, 'EVENING'),
    ).toBe(false);
  });

  it('prints the college name used on the notice board', () => {
    expect(reportCollegeName('Don Bosco College')).toBe(
      'Don Bosco College, Tura',
    );
    expect(reportCollegeName('Don Bosco College, Tura')).toBe(
      'Don Bosco College, Tura',
    );
  });
});
