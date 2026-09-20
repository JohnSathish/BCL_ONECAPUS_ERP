import { compactSchoolLoginId } from './school-sis-login-lookup';
import type { PrismaService } from '../../database/prisma.service';

type StaffLookupUser = {
  sub: string;
  email?: string | null;
};

/**
 * Portal logins are often username/employee-code with a synthetic email.
 * Timetable rows hang off school_staff, so resolve that id from the login.
 */
export async function resolveSchoolStaffIdForUser(
  prisma: PrismaService,
  tenantId: string,
  user: StaffLookupUser,
): Promise<string | null> {
  const linked = await prisma.schoolPersonAccount.findFirst({
    where: {
      tenantId,
      userId: user.sub,
      personType: 'STAFF',
      staffId: { not: null },
    },
    select: { staffId: true },
  });
  if (linked?.staffId) return linked.staffId;

  const account = await prisma.user.findFirst({
    where: { id: user.sub, tenantId, deletedAt: null },
    select: { email: true, username: true, displayName: true },
  });

  const email = (account?.email || user.email || '').trim();
  if (email) {
    const byEmail = await prisma.schoolStaff.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        email: { equals: email, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (byEmail) return byEmail.id;
  }

  const username = account?.username?.trim();
  if (username) {
    const byCode = await prisma.schoolStaff.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        employeeCode: { equals: username, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (byCode) return byCode.id;

    const compact = compactSchoolLoginId(username);
    if (compact) {
      const candidates = await prisma.schoolStaff.findMany({
        where: { tenantId, deletedAt: null },
        select: { id: true, employeeCode: true },
      });
      const hits = candidates.filter(
        (row) => compactSchoolLoginId(row.employeeCode) === compact,
      );
      if (hits.length === 1) return hits[0].id;
    }
  }

  const displayName = account?.displayName?.trim();
  if (displayName) {
    const byName = await prisma.schoolStaff.findMany({
      where: {
        tenantId,
        deletedAt: null,
        fullName: { equals: displayName, mode: 'insensitive' },
      },
      select: { id: true },
      take: 2,
    });
    if (byName.length === 1) return byName[0].id;
  }

  return null;
}
