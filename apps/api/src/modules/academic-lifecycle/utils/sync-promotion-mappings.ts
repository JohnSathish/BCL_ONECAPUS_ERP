import type { PrismaClient } from '@prisma/client';

/**
 * Builds semester-to-semester offering mappings from curriculum structure.
 * Matches offerings by category + department + majorPaperIndex across consecutive semesters.
 */
export async function syncProgramPromotionMappings(
  prisma: PrismaClient,
  tenantId: string,
  programVersionId: string,
  pairs: Array<{ fromSequence: number; toSequence: number }>,
) {
  let created = 0;
  for (const pair of pairs) {
    const fromOfferings = await prisma.courseOffering.findMany({
      where: {
        tenantId,
        programVersionId,
        semesterSequence: pair.fromSequence,
        deletedAt: null,
      },
      include: { course: true },
      orderBy: [{ category: 'asc' }, { majorPaperIndex: 'asc' }],
    });

    const toOfferings = await prisma.courseOffering.findMany({
      where: {
        tenantId,
        programVersionId,
        semesterSequence: pair.toSequence,
        deletedAt: null,
      },
      include: { course: true },
      orderBy: [{ category: 'asc' }, { majorPaperIndex: 'asc' }],
    });

    for (const from of fromOfferings) {
      const category = String(from.category ?? '').toUpperCase();
      const matches = toOfferings.filter((to) => {
        if (String(to.category ?? '').toUpperCase() !== category) return false;
        if (
          from.majorPaperIndex != null &&
          to.majorPaperIndex !== from.majorPaperIndex
        ) {
          return false;
        }
        if (
          from.course.departmentId &&
          to.course.departmentId !== from.course.departmentId
        ) {
          return false;
        }
        return true;
      });

      const target = matches[0];
      if (!target) continue;

      await prisma.programPromotionMapping.upsert({
        where: {
          programVersionId_fromOfferingId_toSequence: {
            programVersionId,
            fromOfferingId: from.id,
            toSequence: pair.toSequence,
          },
        },
        create: {
          tenantId,
          programVersionId,
          fromSequence: pair.fromSequence,
          toSequence: pair.toSequence,
          fromOfferingId: from.id,
          toOfferingId: target.id,
          category,
          majorPaperIndex: from.majorPaperIndex,
        },
        update: {
          toOfferingId: target.id,
          category,
          majorPaperIndex: from.majorPaperIndex,
        },
      });
      created++;
    }
  }
  return { created };
}
