import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SCHOOL_SIS_PRODUCT } from './school-sis.constants';

type BrandingExtras = {
  institutionType?: string;
  schoolProduct?: string;
};

export function compactSchoolLoginId(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/** SLS26-0108 and SLS2026-0108 resolve to the same keys. */
export function schoolLoginCompacts(identifier: string): string[] {
  const compact = compactSchoolLoginId(identifier);
  if (!compact) return [];
  const keys = new Set<string>([compact]);
  const shortYear = compact.match(/^([A-Z]+)(\d{2})(\d{4})$/);
  if (shortYear) {
    keys.add(`${shortYear[1]}20${shortYear[2]}${shortYear[3]}`);
  }
  const longYear = compact.match(/^([A-Z]+)20(\d{2})(\d{4})$/);
  if (longYear) {
    keys.add(`${longYear[1]}${longYear[2]}${longYear[3]}`);
  }
  return [...keys];
}

export async function isSchoolSisTenant(
  prisma: PrismaService,
  tenantId: string,
) {
  const branding = await prisma.tenantBranding.findUnique({
    where: { tenantId },
    select: { portalExtrasJson: true },
  });
  const extras = (branding?.portalExtrasJson ?? {}) as BrandingExtras;
  return (
    extras.schoolProduct === SCHOOL_SIS_PRODUCT ||
    extras.institutionType === 'SCHOOL'
  );
}

export async function resolveSchoolPortalUserId(
  prisma: PrismaService,
  tenantId: string,
  identifier: string,
): Promise<string | null> {
  const trimmed = identifier.trim();
  if (!trimmed) return null;

  if (trimmed.includes('@')) {
    const byEmail = await prisma.user.findFirst({
      where: {
        tenantId,
        email: trimmed.toLowerCase(),
        deletedAt: null,
        isActive: true,
      },
      select: { id: true },
    });
    return byEmail?.id ?? null;
  }

  const byUsername = await prisma.user.findFirst({
    where: {
      tenantId,
      username: { equals: trimmed, mode: 'insensitive' },
      deletedAt: null,
      isActive: true,
    },
    select: { id: true },
  });
  if (byUsername) return byUsername.id;

  const keys = schoolLoginCompacts(trimmed);
  if (!keys.length) return null;
  const inKeys = Prisma.join(keys);

  const usernameHits = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM platform.users
    WHERE tenant_id = ${tenantId}::uuid
      AND deleted_at IS NULL
      AND is_active = true
      AND username IS NOT NULL
      AND regexp_replace(upper(username), '[^A-Z0-9]', '', 'g') IN (${inKeys})
    LIMIT 2
  `;
  if (usernameHits.length === 1) return usernameHits[0].id;

  const admissionRows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM school.school_students
    WHERE tenant_id = ${tenantId}::uuid
      AND deleted_at IS NULL
      AND regexp_replace(upper(admission_number), '[^A-Z0-9]', '', 'g') IN (${inKeys})
    LIMIT 2
  `;
  if (admissionRows.length === 1) {
    const account = await prisma.schoolPersonAccount.findFirst({
      where: {
        tenantId,
        studentId: admissionRows[0].id,
        personType: 'STUDENT',
      },
      select: { userId: true },
    });
    if (account) return account.userId;
  }

  const rollHits = await prisma.$queryRaw<Array<{ student_id: string }>>`
    SELECT student_id FROM school.school_enrollments
    WHERE tenant_id = ${tenantId}::uuid
      AND deleted_at IS NULL
      AND status = 'ACTIVE'
      AND roll_number IS NOT NULL
      AND regexp_replace(upper(roll_number), '[^A-Z0-9]', '', 'g') IN (${inKeys})
    LIMIT 5
  `;
  const uniqueStudentIds = [...new Set(rollHits.map((row) => row.student_id))];
  if (uniqueStudentIds.length === 1) {
    const account = await prisma.schoolPersonAccount.findFirst({
      where: {
        tenantId,
        studentId: uniqueStudentIds[0],
        personType: 'STUDENT',
      },
      select: { userId: true },
    });
    if (account) return account.userId;
  }

  const staffHits = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM school.school_staff
    WHERE tenant_id = ${tenantId}::uuid
      AND deleted_at IS NULL
      AND regexp_replace(upper(employee_code), '[^A-Z0-9]', '', 'g') IN (${inKeys})
    LIMIT 2
  `;
  if (staffHits.length === 1) {
    const account = await prisma.schoolPersonAccount.findFirst({
      where: {
        tenantId,
        staffId: staffHits[0].id,
        personType: 'STAFF',
      },
      select: { userId: true },
    });
    if (account) return account.userId;
  }

  return null;
}
