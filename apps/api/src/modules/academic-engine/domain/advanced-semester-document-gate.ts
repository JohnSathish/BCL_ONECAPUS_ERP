import { BadRequestException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';

const MARKSHEET_DOC_TYPES = new Set([
  'MARKSHEETS_STD_X_ONWARDS',
  'MARKSHEET',
  'CLASS_XII_MARKSHEET',
  'CLASS_X_MARKSHEET',
]);

const MIGRATION_DOC_TYPES = new Set([
  'MIGRATION',
  'TC',
  'TRANSFER_CERTIFICATE',
]);

type DocRow = { documentType: string };

/**
 * Sem 7+ registration requires NEHU marksheet evidence.
 * Lateral / migration admissions also require a migration / TC document.
 */
export async function assertAdvancedSemesterDocuments(
  prisma: Pick<PrismaClient, 'student' | 'studentDocument'>,
  tenantId: string,
  studentId: string,
  semesterSequence: number,
) {
  if (semesterSequence < 7) return;

  const student = await prisma.student.findFirst({
    where: { id: studentId, tenantId, deletedAt: null },
    select: {
      masterProfile: { select: { admissionType: true } },
    },
  });
  if (!student) {
    throw new BadRequestException('Student not found');
  }

  const docs = (await prisma.studentDocument.findMany({
    where: { tenantId, studentId },
    select: { documentType: true },
  })) as DocRow[];

  const types = new Set(
    docs.map((d) =>
      String(d.documentType ?? '')
        .trim()
        .toUpperCase(),
    ),
  );
  const hasMarksheet = [...MARKSHEET_DOC_TYPES].some((t) => types.has(t));
  if (!hasMarksheet) {
    throw new BadRequestException(
      'Semester 7+ registration requires an uploaded NEHU marksheet document (e.g. MARKSHEETS_STD_X_ONWARDS or MARKSHEET) on the student profile.',
    );
  }

  const admissionType = String(student.masterProfile?.admissionType ?? '')
    .trim()
    .toUpperCase();
  if (admissionType === 'LATERAL' || admissionType === 'MIGRATION') {
    const hasMigration = [...MIGRATION_DOC_TYPES].some((t) => types.has(t));
    if (!hasMigration) {
      throw new BadRequestException(
        'Lateral / migration Semester 7+ registration requires an uploaded MIGRATION or TC document on the student profile.',
      );
    }
  }
}
