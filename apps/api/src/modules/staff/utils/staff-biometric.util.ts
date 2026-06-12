import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../../../database/prisma.service';

export const BIOMETRIC_ID_MAX_LENGTH = 50;

export function normalizeBiometricId(
  value: string | null | undefined,
): string | undefined {
  if (value == null) return undefined;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, BIOMETRIC_ID_MAX_LENGTH);
}

export async function resolveStaffInstitutionId(
  prisma: PrismaService,
  tenantId: string,
  input: {
    campusId?: string | null;
    departmentId?: string | null;
    primaryShiftId?: string | null;
  },
): Promise<string | null> {
  if (input.campusId) {
    const campus = await prisma.campus.findFirst({
      where: { id: input.campusId, tenantId, deletedAt: null },
      select: { institutionId: true },
    });
    if (campus?.institutionId) return campus.institutionId;
  }
  if (input.departmentId) {
    const dept = await prisma.department.findFirst({
      where: { id: input.departmentId, tenantId, deletedAt: null },
      select: { campus: { select: { institutionId: true } } },
    });
    if (dept?.campus?.institutionId) return dept.campus.institutionId;
  }
  if (input.primaryShiftId) {
    const shift = await prisma.shift.findFirst({
      where: { id: input.primaryShiftId, tenantId, deletedAt: null },
      select: { campus: { select: { institutionId: true } } },
    });
    if (shift?.campus?.institutionId) return shift.campus.institutionId;
  }
  return null;
}

export async function assertBiometricIdUnique(
  prisma: PrismaService,
  tenantId: string,
  biometricId: string,
  options: {
    institutionId?: string | null;
    campusId?: string | null;
    departmentId?: string | null;
    primaryShiftId?: string | null;
    excludeStaffId?: string;
  },
): Promise<void> {
  const normalized = normalizeBiometricId(biometricId);
  if (!normalized) return;

  const institutionId =
    options.institutionId ??
    (await resolveStaffInstitutionId(prisma, tenantId, {
      campusId: options.campusId,
      departmentId: options.departmentId,
      primaryShiftId: options.primaryShiftId,
    }));

  const campusIds = institutionId
    ? (
        await prisma.campus.findMany({
          where: { tenantId, institutionId, deletedAt: null },
          select: { id: true },
        })
      ).map((c) => c.id)
    : [];

  const taken = await prisma.staffProfile.findFirst({
    where: {
      tenantId,
      deletedAt: null,
      biometricId: normalized,
      ...(options.excludeStaffId
        ? { NOT: { id: options.excludeStaffId } }
        : {}),
      ...(campusIds.length > 0 ? { campusId: { in: campusIds } } : {}),
    },
    select: { id: true, fullName: true },
  });

  if (taken) {
    throw new ConflictException(
      'Biometric ID already in use for this institution',
    );
  }
}
