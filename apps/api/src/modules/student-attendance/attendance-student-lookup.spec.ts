import { loadAttendanceStudents } from './attendance-student-lookup';

const student = {
  id: 'student-1',
  userId: 'user-1',
  rollNumber: 'ECO-014',
  enrollmentNumber: 'DBC-014',
  admissionNumber: null,
  universityRollNumber: null,
  universityRegistrationNumber: null,
  masterProfile: { fullName: 'Agnel Marak', mobileNumber: null, email: null },
  user: { displayName: 'Agnel', username: 'ECO-014', email: null },
};

function client(overrides?: {
  byId?: unknown[];
  byUser?: unknown[];
  registrations?: unknown[];
  lines?: unknown[];
}) {
  const studentFindMany = jest.fn(
    async ({ where }: { where: { id?: unknown; userId?: unknown } }) => {
      if (where.userId) return overrides?.byUser ?? [];
      return overrides?.byId ?? [];
    },
  );
  return {
    student: { findMany: studentFindMany },
    semesterRegistration: {
      findMany: jest.fn(async () => overrides?.registrations ?? []),
    },
    semesterRegistrationLine: {
      findMany: jest.fn(async () => overrides?.lines ?? []),
    },
  };
}

describe('loadAttendanceStudents', () => {
  it('finds a student by the attendance student id', async () => {
    const prisma = client({ byId: [student] });
    const map = await loadAttendanceStudents(prisma as never, 'tenant', [
      'student-1',
    ]);
    expect(map.get('student-1')?.masterProfile?.fullName).toBe('Agnel Marak');
    expect(prisma.semesterRegistration.findMany).not.toHaveBeenCalled();
  });

  it('finds a student when the mark stored the login id', async () => {
    const prisma = client({ byId: [], byUser: [student] });
    const map = await loadAttendanceStudents(prisma as never, 'tenant', [
      'user-1',
    ]);
    expect(map.get('user-1')?.rollNumber).toBe('ECO-014');
  });

  it('finds a student from the registration row id', async () => {
    const prisma = client({
      byId: [],
      byUser: [],
      registrations: [{ id: 'reg-1', student }],
    });
    const map = await loadAttendanceStudents(prisma as never, 'tenant', [
      'reg-1',
    ]);
    expect(map.get('reg-1')?.id).toBe('student-1');
  });
});
