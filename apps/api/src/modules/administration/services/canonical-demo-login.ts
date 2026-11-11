import { Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { istCalendar } from '../../communication/domain/birthday-calendar';
import type { PrismaService } from '../../../database/prisma.service';

const DEMO = 'DEMO';

export const CANONICAL_DEMO_LOGINS = [
  {
    kind: 'STUDENT' as const,
    loginId: 'DEMO-STUDENT',
    password: 'DemoStudent@2026',
    displayName: 'Demo Student',
  },
  {
    kind: 'STAFF' as const,
    loginId: 'DEMO-STAFF',
    password: 'DemoStaff@2026',
    displayName: 'Demo Staff',
  },
];

type CanonicalDemoLogin = (typeof CANONICAL_DEMO_LOGINS)[number];

const log = new Logger('CanonicalDemoLogin');

/** Today's calendar date in India, stored as a date-only value. */
export function demoStudentBirthdayDate(now = new Date()): Date {
  const today = istCalendar(now);
  return new Date(Date.UTC(today.year, today.month - 1, today.day));
}

export function matchCanonicalDemoLogin(
  loginId: string,
  password: string,
): CanonicalDemoLogin | null {
  const id = loginId.trim().toUpperCase();
  const typed = password.trim();
  return (
    CANONICAL_DEMO_LOGINS.find(
      (row) => row.loginId === id && row.password === typed,
    ) ?? null
  );
}

/**
 * Create the published demo student or staff login, or put its password back
 * when the stored hash no longer matches the published password.
 * Returns true only when that exact login can now sign in.
 */
export async function ensureCanonicalDemoLogin(
  prisma: PrismaService,
  tenantId: string,
  loginId: string,
  password: string,
): Promise<boolean> {
  const match = matchCanonicalDemoLogin(loginId, password);
  if (!match) return false;
  try {
    const email = `${match.loginId.toLowerCase()}@demo.onecampus.invalid`;
    const existing = await prisma.user.findFirst({
      where: {
        tenantId,
        OR: [
          { username: { equals: match.loginId, mode: 'insensitive' } },
          { email: { equals: email, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        accountType: true,
        passwordHash: true,
        deletedAt: true,
        isActive: true,
        accountStatus: true,
      },
    });
    if (existing && existing.accountType !== DEMO) return false;

    const passwordHash = await bcrypt.hash(match.password, 12);
    if (!existing) {
      await createCanonicalDemo(prisma, tenantId, match, email, passwordHash);
      return true;
    }

    const matches =
      !existing.deletedAt &&
      existing.isActive &&
      existing.accountStatus === 'active' &&
      (await bcrypt.compare(match.password, existing.passwordHash));
    if (!matches) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          isActive: true,
          accountStatus: 'active',
          mustResetPassword: false,
          passwordChangedAt: new Date(),
          accountType: DEMO,
          deletedAt: null,
          username: match.loginId,
        },
      });
    }
    if (match.kind === 'STUDENT') {
      await syncDemoStudentBirthday(prisma, tenantId, existing.id);
    }
    return true;
  } catch (error) {
    log.warn(
      `Could not prepare ${loginId.trim().toUpperCase()}: ${
        error instanceof Error ? error.name : 'error'
      }`,
    );
    return false;
  }
}

async function createCanonicalDemo(
  prisma: PrismaService,
  tenantId: string,
  match: CanonicalDemoLogin,
  email: string,
  passwordHash: string,
) {
  const slugs = match.kind === 'STUDENT' ? ['student'] : ['faculty', 'staff'];
  const role = await prisma.role.findFirst({
    where: { tenantId, slug: { in: slugs }, deletedAt: null },
    orderBy: { slug: 'asc' },
  });
  if (!role) {
    throw new Error('missing-role');
  }
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        tenantId,
        email,
        username: match.loginId,
        displayName: match.displayName,
        passwordHash,
        emailVerifiedAt: new Date(),
        isActive: true,
        accountStatus: 'active',
        accountType: DEMO,
        mustResetPassword: false,
      },
    });
    await tx.userRole.create({ data: { userId: user.id, roleId: role.id } });
    if (match.kind === 'STUDENT') {
      const student = await tx.student.create({
        data: {
          tenantId,
          userId: user.id,
          enrollmentNumber: match.loginId,
          rollNumber: match.loginId,
          accountType: DEMO,
        },
      });
      await tx.studentProfile.create({
        data: {
          tenantId,
          studentId: student.id,
          fullName: match.displayName,
          email,
          dateOfBirth: demoStudentBirthdayDate(),
          studentStatus: 'DEMO',
          admissionStatus: 'DEMO',
        },
      });
      return;
    }
    await tx.staffProfile.create({
      data: {
        tenantId,
        portalUserId: user.id,
        employeeCode: match.loginId,
        fullName: match.displayName,
        email,
        staffType: 'TEACHING',
        employmentType: 'DEMO',
        employeeCodeAutoGenerated: false,
        status: 'ACTIVE',
        accountType: DEMO,
        showOnWebsite: false,
      },
    });
  });
}

/**
 * Keep the published demo student's birthday on today's date and clear the
 * once-per-day card acknowledgement so the wishes card can be checked again.
 */
export async function syncDemoStudentBirthday(
  prisma: PrismaService,
  tenantId: string,
  userId: string,
) {
  const student = await prisma.student.findFirst({
    where: { tenantId, userId, deletedAt: null, accountType: DEMO },
    select: { id: true, masterProfile: { select: { id: true } } },
  });
  if (!student) return;
  const dateOfBirth = demoStudentBirthdayDate();
  if (student.masterProfile) {
    await prisma.studentProfile.update({
      where: { studentId: student.id },
      data: { dateOfBirth },
    });
  } else {
    await prisma.studentProfile.create({
      data: {
        tenantId,
        studentId: student.id,
        fullName: 'Demo Student',
        dateOfBirth,
        studentStatus: 'DEMO',
        admissionStatus: 'DEMO',
      },
    });
  }
  await prisma.birthdayPopupAck.deleteMany({
    where: { tenantId, userId, userType: 'STUDENT' },
  });
}
