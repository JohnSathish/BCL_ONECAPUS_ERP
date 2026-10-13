import type { PrismaClient } from '@prisma/client';
import {
  listDbcMajorProgramCodes,
  buildFyugpSem1MinorMappings,
} from '../src/modules/academic-engine/domain/dbc-major-minor-matrix';

export type Sem1MinorOfferingResult = {
  created: number;
  alreadyPresent: number;
  missingCourses: string[];
  commerceAliasMinors: number;
  commerceAliasPools: number;
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

  for (const programCode of listDbcMajorProgramCodes()) {
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

  const commerceAlias = await alignCommerceComWithBcom(prisma, tenantId);

  return {
    created,
    alreadyPresent,
    missingCourses,
    commerceAliasMinors: commerceAlias.minorsCreated,
    commerceAliasPools: commerceAlias.poolsCopied,
  };
}

/**
 * Programme COM is the same Commerce major as BCOM, but the catalogue seed
 * writes minors and shared pools only onto BCOM. Copy the missing rows across.
 */
async function alignCommerceComWithBcom(
  prisma: PrismaClient,
  tenantId: string,
): Promise<{ minorsCreated: number; poolsCopied: number }> {
  const bcom = await prisma.program.findFirst({
    where: { tenantId, code: 'BCOM', deletedAt: null },
    include: { versions: { where: { deletedAt: null } } },
  });
  const com = await prisma.program.findFirst({
    where: { tenantId, code: 'COM', deletedAt: null },
    include: { versions: { where: { deletedAt: null } } },
  });
  if (!bcom || !com) return { minorsCreated: 0, poolsCopied: 0 };

  let minorsCreated = 0;
  let poolsCopied = 0;

  for (const comVersion of com.versions) {
    const bcomVersion =
      bcom.versions.find((version) => version.version === comVersion.version) ??
      bcom.versions.find((version) => version.version === 1) ??
      bcom.versions[0];
    if (!bcomVersion) continue;

    const sourceMinors = await prisma.courseOffering.findMany({
      where: {
        tenantId,
        programVersionId: bcomVersion.id,
        category: 'MINOR',
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

    for (const source of sourceMinors) {
      if (source.semesterSequence == null) continue;
      const existing = await prisma.courseOffering.findFirst({
        where: {
          tenantId,
          programVersionId: comVersion.id,
          courseId: source.courseId,
          semesterSequence: source.semesterSequence,
          category: 'MINOR',
          mappingSource: 'DIRECT',
          deletedAt: null,
        },
        select: { id: true },
      });
      if (existing) continue;

      const hostMajor = await prisma.courseOffering.findFirst({
        where: {
          tenantId,
          programVersionId: comVersion.id,
          semesterSequence: source.semesterSequence,
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

      const offering = await prisma.courseOffering.create({
        data: {
          tenantId,
          programVersionId: comVersion.id,
          courseId: source.courseId,
          mappingSource: 'DIRECT',
          semesterId: hostMajor.semesterId ?? source.semesterId,
          category: 'MINOR',
          semesterSequence: source.semesterSequence,
          capacity: hostMajor.capacity,
          waitlistCapacity: hostMajor.waitlistCapacity,
          titleOverride: null,
        },
      });
      const sections = hostMajor.sections.length
        ? hostMajor.sections
        : source.sections;
      for (const section of sections) {
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
      minorsCreated += 1;
    }

    const assignments = await prisma.programmePoolAssignment.findMany({
      where: {
        tenantId,
        programVersionId: bcomVersion.id,
        active: true,
      },
    });
    for (const assignment of assignments) {
      const exists = await prisma.programmePoolAssignment.findFirst({
        where: {
          tenantId,
          programVersionId: comVersion.id,
          poolId: assignment.poolId,
          semesterNo: assignment.semesterNo,
          shiftId: assignment.shiftId,
          active: true,
        },
        select: { id: true },
      });
      if (exists) continue;
      await prisma.programmePoolAssignment.create({
        data: {
          tenantId,
          programVersionId: comVersion.id,
          semesterNo: assignment.semesterNo,
          poolId: assignment.poolId,
          shiftId: assignment.shiftId,
          active: true,
        },
      });
      poolsCopied += 1;
    }
  }

  return { minorsCreated, poolsCopied };
}
