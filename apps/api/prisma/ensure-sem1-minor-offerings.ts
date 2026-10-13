import type { PrismaClient } from '@prisma/client';
import {
  DBC_MAJOR_PROGRAM_CODE,
  buildFyugpSem1MinorMappings,
} from '../src/modules/academic-engine/domain/dbc-major-minor-matrix';

export type Sem1MinorOfferingResult = {
  created: number;
  alreadyPresent: number;
  missingCourses: string[];
};

/**
 * Add Semester 1 Minor mappings for each allowed major–minor pair.
 * The offering points at the other department's existing -100 course.
 * Course titles, the owner's Major offering, and student registrations are left unchanged.
 */
export async function ensureSem1MinorOfferings(
  prisma: PrismaClient,
  tenantId: string,
): Promise<Sem1MinorOfferingResult> {
  let created = 0;
  let alreadyPresent = 0;
  const missingCourses: string[] = [];

  for (const programCode of Object.values(DBC_MAJOR_PROGRAM_CODE)) {
    const mappings = buildFyugpSem1MinorMappings(programCode);
    if (!mappings.length) continue;

    const versions = await prisma.programVersion.findMany({
      where: {
        tenantId,
        deletedAt: null,
        program: { code: programCode, tenantId, deletedAt: null },
      },
      select: { id: true },
    });

    for (const version of versions) {
      const hostMajor = await prisma.courseOffering.findFirst({
        where: {
          tenantId,
          programVersionId: version.id,
          semesterSequence: 1,
          category: 'MAJOR',
          mappingSource: 'DIRECT',
          deletedAt: null,
        },
        include: {
          sections: {
            where: { deletedAt: null },
            select: {
              shiftId: true,
              sectionCode: true,
              capacity: true,
              waitlistCapacity: true,
            },
          },
        },
      });
      if (!hostMajor) continue;

      for (const mapping of mappings) {
        const course = await prisma.course.findFirst({
          where: {
            tenantId,
            deletedAt: null,
            code: { equals: mapping.courseCode, mode: 'insensitive' },
          },
          select: { id: true, code: true },
        });
        if (!course) {
          missingCourses.push(`${programCode} ${mapping.courseCode}`);
          continue;
        }

        const existing = await prisma.courseOffering.findFirst({
          where: {
            tenantId,
            programVersionId: version.id,
            courseId: course.id,
            semesterSequence: 1,
            category: 'MINOR',
            mappingSource: 'DIRECT',
            deletedAt: null,
          },
          select: { id: true },
        });
        if (existing) {
          alreadyPresent += 1;
          continue;
        }

        const offering = await prisma.courseOffering.create({
          data: {
            tenantId,
            programVersionId: version.id,
            courseId: course.id,
            mappingSource: 'DIRECT',
            semesterId: hostMajor.semesterId,
            category: 'MINOR',
            semesterSequence: 1,
            capacity: hostMajor.capacity,
            waitlistCapacity: hostMajor.waitlistCapacity,
            titleOverride: null,
          },
        });

        for (const section of hostMajor.sections) {
          const createdSection = await prisma.offeringSection.create({
            data: {
              tenantId,
              courseOfferingId: offering.id,
              shiftId: section.shiftId,
              sectionCode: section.sectionCode,
              capacity: section.capacity,
              waitlistCapacity: section.waitlistCapacity,
              status: 'active',
            },
          });
          await prisma.offeringSeatLedger.upsert({
            where: { offeringSectionId: createdSection.id },
            create: { tenantId, offeringSectionId: createdSection.id },
            update: {},
          });
        }
        created += 1;
      }
    }
  }

  return { created, alreadyPresent, missingCourses };
}
