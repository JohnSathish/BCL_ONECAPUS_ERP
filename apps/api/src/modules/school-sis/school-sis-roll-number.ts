import { ConflictException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { SCHOOL_ADMISSION_NUMBER_PREFIX } from './school-sis.constants';

export const SCHOOL_ROLL_NUMBER_PATTERN = /^SLS\d{2}-\d{4}$/i;

export function schoolYearShortCode(yearCode: string, at = new Date()): string {
  const match = yearCode.match(/20(\d{2})/);
  if (match?.[1]) return match[1];
  return String(at.getFullYear()).slice(-2);
}

export function formatSchoolRollNumber(
  yearCode: string,
  sequence: number,
): string {
  return `${SCHOOL_ADMISSION_NUMBER_PREFIX}${schoolYearShortCode(yearCode)}-${String(sequence).padStart(4, '0')}`;
}

export function isSchoolRollNumber(value?: string | null): boolean {
  return Boolean(value && SCHOOL_ROLL_NUMBER_PATTERN.test(value.trim()));
}

export async function nextSchoolRollNumber(
  tx: Prisma.TransactionClient,
  tenantId: string,
  academicYearId: string,
  yearCode: string,
): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const row = await tx.schoolIdSequence.upsert({
      where: {
        tenantId_academicYearId_kind: {
          tenantId,
          academicYearId,
          kind: 'ROLL',
        },
      },
      update: { lastValue: { increment: 1 } },
      create: {
        tenantId,
        academicYearId,
        kind: 'ROLL',
        lastValue: 1,
      },
    });
    const value = formatSchoolRollNumber(yearCode, row.lastValue);
    const clash = await tx.schoolEnrollment.findFirst({
      where: {
        tenantId,
        academicYearId,
        rollNumber: { equals: value, mode: 'insensitive' },
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!clash) return value;
  }
  throw new ConflictException(
    'Could not allocate a unique roll number for this admission year.',
  );
}

export async function resolveSchoolEnrollmentRollNumber(
  tx: Prisma.TransactionClient,
  args: {
    tenantId: string;
    studentId: string;
    academicYearId: string;
    yearCode: string;
    requested?: string | null;
  },
): Promise<string> {
  const requested = args.requested?.trim().toUpperCase() || null;
  if (requested && isSchoolRollNumber(requested)) {
    const clash = await tx.schoolEnrollment.findFirst({
      where: {
        tenantId: args.tenantId,
        academicYearId: args.academicYearId,
        rollNumber: { equals: requested, mode: 'insensitive' },
        deletedAt: null,
        NOT: { studentId: args.studentId },
      },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException(
        `Roll number ${requested} is already used in this admission year.`,
      );
    }
    return requested;
  }

  const previous = await tx.schoolEnrollment.findFirst({
    where: {
      tenantId: args.tenantId,
      studentId: args.studentId,
      deletedAt: null,
      rollNumber: { not: null },
    },
    orderBy: { createdAt: 'asc' },
    select: { rollNumber: true },
  });
  if (isSchoolRollNumber(previous?.rollNumber)) {
    return previous!.rollNumber!.toUpperCase();
  }

  return nextSchoolRollNumber(
    tx,
    args.tenantId,
    args.academicYearId,
    args.yearCode,
  );
}
