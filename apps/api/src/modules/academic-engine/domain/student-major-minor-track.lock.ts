import type { Prisma } from '@prisma/client';
import { slugifySubject } from './nep-categories';

/** Lock major/minor subject path when promoted to semester 2+. Safe to call from promotion runs. */
export async function lockMajorMinorTrackOnPromotion(
  tx: Prisma.TransactionClient,
  tenantId: string,
  studentId: string,
  toSequence: number,
  promotionRunId?: string,
) {
  if (toSequence < 2) return;

  const existing = await tx.studentMajorMinorTrack.findUnique({
    where: { studentId },
  });
  if (!existing) {
    await syncMajorMinorTrackFromChoices(tx, tenantId, studentId);
  }

  await tx.studentMajorMinorTrack.updateMany({
    where: { tenantId, studentId, isTrackLocked: false },
    data: {
      isTrackLocked: true,
      lockedAtSemester: 2,
      lockedAt: new Date(),
      lockedByPromotionRunId: promotionRunId ?? null,
    },
  });
}

export async function syncMajorMinorTrackFromChoices(
  tx: Prisma.TransactionClient,
  tenantId: string,
  studentId: string,
) {
  const choices = await tx.studentProgramChoice.findMany({
    where: { tenantId, studentId, status: 'active', deletedAt: null },
  });
  const majorSlug = choices.find((c) => c.choiceType === 'MAJOR')?.subjectSlug;
  if (!majorSlug) return null;

  const minorSlug = choices.find((c) => c.choiceType === 'MINOR')?.subjectSlug;
  const student = await tx.student.findFirst({
    where: { id: studentId, tenantId },
    select: {
      programVersion: {
        select: {
          program: {
            select: { department: { select: { institutionId: true } } },
          },
        },
      },
    },
  });
  const institutionId =
    student?.programVersion?.program?.department?.institutionId;
  if (!institutionId) return null;

  const majorSubject = await tx.academicSubject.findFirst({
    where: {
      tenantId,
      institutionId,
      slug: slugifySubject(majorSlug),
      deletedAt: null,
      isActive: true,
    },
  });
  if (!majorSubject) return null;

  const minorSubject = minorSlug
    ? await tx.academicSubject.findFirst({
        where: {
          tenantId,
          institutionId,
          slug: slugifySubject(minorSlug),
          deletedAt: null,
          isActive: true,
        },
      })
    : null;

  return tx.studentMajorMinorTrack.upsert({
    where: { studentId },
    create: {
      tenantId,
      studentId,
      majorSubjectId: majorSubject.id,
      minorSubjectId: minorSubject?.id ?? null,
    },
    update: {
      majorSubjectId: majorSubject.id,
      minorSubjectId: minorSubject?.id ?? null,
    },
  });
}
