import type { PrismaService } from '../../../database/prisma.service';
import {
  artsHostProgramCodes,
  sharedCodeMinorTitlePairs,
} from '../domain/offering-paper-title';

/**
 * The course master can hold only one title per code. Semester-5 minors that
 * share a major code (EDN-302) keep their own name on the minor offering.
 * Live course titles that no longer match the catalog major title are left
 * alone, so a renamed subject such as Garo is not written back.
 */
export async function syncSharedCodeMinorTitles(
  prisma: PrismaService,
  tenantId: string,
) {
  const pairs = sharedCodeMinorTitlePairs();
  if (!pairs.length) return;

  const courses = await prisma.course.findMany({
    where: {
      tenantId,
      deletedAt: null,
      OR: pairs.map((pair) => ({
        AND: [
          { code: { equals: pair.courseCode, mode: 'insensitive' as const } },
          {
            title: { equals: pair.majorTitle, mode: 'insensitive' as const },
          },
        ],
      })),
    },
    select: { id: true, code: true },
  });
  const courseByCode = new Map(
    courses.map((course) => [course.code.trim().toUpperCase(), course]),
  );
  const applicable = pairs.flatMap((pair) => {
    const course = courseByCode.get(pair.courseCode);
    return course ? [{ ...pair, courseId: course.id }] : [];
  });
  if (!applicable.length) return;

  for (const pair of applicable) {
    await prisma.courseOffering.updateMany({
      where: {
        tenantId,
        deletedAt: null,
        semesterSequence: 5,
        courseId: pair.courseId,
        category: { equals: 'MINOR', mode: 'insensitive' },
        OR: [
          { titleOverride: null },
          { titleOverride: '' },
          {
            titleOverride: {
              equals: pair.majorTitle,
              mode: 'insensitive',
            },
          },
        ],
      },
      data: { titleOverride: pair.minorTitle },
    });
  }

  const hostCodes = artsHostProgramCodes();
  const versions = await prisma.programVersion.findMany({
    where: {
      tenantId,
      deletedAt: null,
      status: { in: ['PUBLISHED', 'published', 'ACTIVE', 'active'] },
      program: {
        deletedAt: null,
        OR: hostCodes.map((code) => ({
          code: { equals: code, mode: 'insensitive' as const },
        })),
      },
    },
    select: { id: true, program: { select: { code: true } } },
  });
  if (!versions.length) return;

  const versionIds = versions.map((version) => version.id);
  const courseIds = applicable.map((pair) => pair.courseId);
  const [existing, anchors] = await Promise.all([
    prisma.courseOffering.findMany({
      where: {
        tenantId,
        deletedAt: null,
        semesterSequence: 5,
        courseId: { in: courseIds },
        programVersionId: { in: versionIds },
        category: { equals: 'MINOR', mode: 'insensitive' },
      },
      select: { programVersionId: true, courseId: true },
    }),
    prisma.courseOffering.findMany({
      where: {
        tenantId,
        deletedAt: null,
        semesterSequence: 5,
        programVersionId: { in: versionIds },
      },
      select: { programVersionId: true, semesterId: true },
    }),
  ]);
  const have = new Set(
    existing.map((row) => `${row.programVersionId}|${row.courseId}`),
  );
  const semesterByVersion = new Map<string, string | null>();
  for (const row of anchors) {
    if (row.programVersionId && !semesterByVersion.has(row.programVersionId)) {
      semesterByVersion.set(row.programVersionId, row.semesterId);
    }
  }

  const creates: Array<{
    tenantId: string;
    programVersionId: string;
    courseId: string;
    mappingSource: string;
    semesterId: string | null;
    category: string;
    semesterSequence: number;
    capacity: number;
    waitlistCapacity: number;
    titleOverride: string;
  }> = [];
  for (const version of versions) {
    if (!semesterByVersion.has(version.id)) continue;
    const programCode = version.program.code.trim().toUpperCase();
    for (const pair of applicable) {
      if (pair.ownerProgramCode.toUpperCase() === programCode) continue;
      const key = `${version.id}|${pair.courseId}`;
      if (have.has(key)) continue;
      have.add(key);
      creates.push({
        tenantId,
        programVersionId: version.id,
        courseId: pair.courseId,
        mappingSource: 'DIRECT',
        semesterId: semesterByVersion.get(version.id) ?? null,
        category: 'MINOR',
        semesterSequence: 5,
        capacity: 80,
        waitlistCapacity: 20,
        titleOverride: pair.minorTitle,
      });
    }
  }
  if (creates.length) {
    await prisma.courseOffering.createMany({ data: creates });
  }
}
