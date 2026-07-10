import { PrismaService } from '../../../database/prisma.service';

export type SoftGateEvaluation = {
  enabled: boolean;
  minCompletionPercent: number;
  softBlockRegistration: boolean;
  softBlockCertificates: boolean;
  blockRegistration: boolean;
  blockCertificates: boolean;
  message: string | null;
};

/**
 * Lightweight soft-gate read used by registration/certificates without importing StudentsModule
 * (avoids Nest circular module graphs).
 */
export async function evaluateProfileSoftGateFromPrisma(
  prisma: PrismaService,
  tenantId: string,
  _studentId: string,
  completionPercent: number,
): Promise<SoftGateEvaluation> {
  const db = prisma as unknown as Record<string, any>;
  const row = await db.studentProfileUpdatePolicy?.findUnique?.({
    where: {
      tenantId_sectionKey_fieldKey: {
        tenantId,
        sectionKey: '__settings__',
        fieldKey: 'soft_gates',
      },
    },
  });
  const meta = (row?.metadata ?? {}) as Record<string, unknown>;
  const enabled = Boolean(meta.enabled ?? false);
  const minCompletionPercent = Number(meta.minCompletionPercent ?? 80);
  const softBlockRegistration = Boolean(meta.softBlockRegistration ?? false);
  const softBlockCertificates = Boolean(meta.softBlockCertificates ?? false);
  const incomplete = completionPercent < minCompletionPercent;
  const active = enabled && incomplete;
  const message = active
    ? `Profile is ${completionPercent}% complete (minimum ${minCompletionPercent}%). Please complete pending fields.`
    : null;
  return {
    enabled,
    minCompletionPercent,
    softBlockRegistration,
    softBlockCertificates,
    blockRegistration: active && softBlockRegistration,
    blockCertificates: active && softBlockCertificates,
    message,
  };
}

/** Rough completion % from key profile checks (aligned with portal soft-gate intent). */
export async function roughProfileCompletionPercent(
  prisma: PrismaService,
  tenantId: string,
  studentId: string,
): Promise<number> {
  const [profile, guardians, boardExam] = await Promise.all([
    prisma.studentProfile.findFirst({ where: { tenantId, studentId } }),
    prisma.studentGuardian.findMany({ where: { tenantId, studentId } }),
    prisma.studentBoardExam.findFirst({
      where: { tenantId, studentId },
      include: { subjectMarks: true },
    }),
  ]);
  const father = guardians.find((g) => g.guardianType === 'FATHER');
  const checks = [
    Boolean(profile?.fullName),
    Boolean(profile?.mobileNumber?.trim()),
    Boolean(profile?.nationalId?.trim()),
    Boolean(profile?.photoPath),
    Boolean(father?.contactNumber?.trim() || profile?.guardianMobile?.trim()),
    Boolean(
      (profile as any)?.bankName &&
      (profile as any)?.accountNumber &&
      (profile as any)?.ifsc,
    ),
    Boolean(
      boardExam?.boardName &&
      boardExam?.totalMarks != null &&
      (boardExam.subjectMarks?.length ?? 0) > 0,
    ),
  ];
  const filled = checks.filter(Boolean).length;
  return Math.round((filled / checks.length) * 100);
}
