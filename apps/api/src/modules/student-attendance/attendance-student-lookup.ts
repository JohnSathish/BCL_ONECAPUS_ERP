import { attendanceStudentSelect } from './attendance-display.util';

const CHUNK = 400;

type AttendanceStudent = {
  id: string;
  userId: string;
  rollNumber?: string | null;
  enrollmentNumber?: string | null;
  admissionNumber?: string | null;
  universityRollNumber?: string | null;
  universityRegistrationNumber?: string | null;
  masterProfile?: {
    fullName?: string | null;
    mobileNumber?: string | null;
    email?: string | null;
  } | null;
  user?: {
    displayName?: string | null;
    username?: string | null;
    email?: string | null;
  } | null;
};

type LookupClient = {
  student: {
    findMany: (args: {
      where: Record<string, unknown>;
      select: typeof attendanceStudentSelect;
    }) => Promise<AttendanceStudent[]>;
  };
  semesterRegistration: {
    findMany: (args: {
      where: Record<string, unknown>;
      select: {
        id: true;
        student: { select: typeof attendanceStudentSelect };
      };
    }) => Promise<Array<{ id: string; student: AttendanceStudent | null }>>;
  };
  semesterRegistrationLine: {
    findMany: (args: {
      where: Record<string, unknown>;
      select: {
        id: true;
        registration: {
          select: { student: { select: typeof attendanceStudentSelect } };
        };
      };
    }) => Promise<
      Array<{
        id: string;
        registration: { student: AttendanceStudent | null } | null;
      }>
    >;
  };
};

function chunks(ids: string[]) {
  const groups: string[][] = [];
  for (let index = 0; index < ids.length; index += CHUNK) {
    groups.push(ids.slice(index, index + CHUNK));
  }
  return groups;
}

function remember(
  map: Map<string, AttendanceStudent>,
  key: string | null | undefined,
  student: AttendanceStudent | null | undefined,
) {
  if (!key || !student) return;
  map.set(key, student);
}

/**
 * Attendance rows store a student id. Older marks, and a demo-account list
 * filter, can miss that row when the report asks only for Student.id.
 * Match the stored id to the student, the login, or the registration row.
 */
export async function loadAttendanceStudents(
  prisma: LookupClient,
  tenantId: string,
  rawIds: string[],
) {
  const ids = [
    ...new Set(rawIds.filter((id) => typeof id === 'string' && id.length > 0)),
  ];
  const map = new Map<string, AttendanceStudent>();
  if (!ids.length) return map;

  for (const idChunk of chunks(ids)) {
    const rows = await prisma.student.findMany({
      where: {
        tenantId,
        id: { in: idChunk },
        accountType: { in: ['NORMAL', 'DEMO'] },
      },
      select: attendanceStudentSelect,
    });
    for (const row of rows) remember(map, row.id, row);
  }

  const missingAfterId = ids.filter((id) => !map.has(id));
  for (const idChunk of chunks(missingAfterId)) {
    const rows = await prisma.student.findMany({
      where: {
        tenantId,
        userId: { in: idChunk },
        accountType: { in: ['NORMAL', 'DEMO'] },
      },
      select: attendanceStudentSelect,
    });
    for (const row of rows) remember(map, row.userId, row);
  }

  const missingAfterUser = ids.filter((id) => !map.has(id));
  for (const idChunk of chunks(missingAfterUser)) {
    const [registrations, lines] = await Promise.all([
      prisma.semesterRegistration.findMany({
        where: { tenantId, id: { in: idChunk } },
        select: { id: true, student: { select: attendanceStudentSelect } },
      }),
      prisma.semesterRegistrationLine.findMany({
        where: { tenantId, id: { in: idChunk } },
        select: {
          id: true,
          registration: {
            select: { student: { select: attendanceStudentSelect } },
          },
        },
      }),
    ]);
    for (const row of registrations) remember(map, row.id, row.student);
    for (const row of lines) {
      remember(map, row.id, row.registration?.student);
    }
  }

  return map;
}
