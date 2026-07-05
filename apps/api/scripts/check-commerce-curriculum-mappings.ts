import { PrismaClient } from '@prisma/client';
import {
  buildCommerceFyugpEvenCourses,
  buildCommerceFyugpSem2MinorCourseDefs,
  buildCommerceFyugpSem5MinorCourseDefs,
} from '../src/modules/academic-engine/domain/commerce-fyugp-even-catalog';
import { buildCommerceFyugpOddCourses } from '../src/modules/academic-engine/domain/commerce-fyugp-odd-catalog';
import { COMMERCE_FYUGP_DEPARTMENTS } from '../src/modules/academic-engine/domain/commerce-fyugp-odd-catalog';

const prisma = new PrismaClient();

function expectedDirectCodes(programCode: string): string[] {
  const odd = buildCommerceFyugpOddCourses().filter(
    (c) => c.programCode === programCode,
  );
  const even = buildCommerceFyugpEvenCourses().filter(
    (c) =>
      c.programCode === programCode &&
      (c.category === 'MAJOR' || c.category === 'INTERNSHIP'),
  );
  const codes = new Set([
    ...odd.map((c) => c.code),
    ...even
      .filter(
        (c) =>
          c.semesterSequence === 2 ||
          c.semesterSequence === 4 ||
          c.semesterSequence === 6,
      )
      .map((c) => c.code),
  ]);
  return [...codes].sort();
}

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  if (!tenant) throw new Error('demo tenant not found');

  let totalMissing = 0;

  for (const dept of COMMERCE_FYUGP_DEPARTMENTS) {
    const program = await prisma.program.findFirst({
      where: { tenantId: tenant.id, code: dept.programCode, deletedAt: null },
      include: {
        versions: { where: { deletedAt: null, version: 1 }, take: 1 },
      },
    });
    if (!program?.versions[0]) {
      console.log(`${dept.programCode}: MISSING programme version`);
      continue;
    }
    const versionId = program.versions[0].id;
    const expected = expectedDirectCodes(dept.programCode);

    const offerings = await prisma.courseOffering.findMany({
      where: {
        tenantId: tenant.id,
        programVersionId: versionId,
        mappingSource: 'DIRECT',
        deletedAt: null,
        course: { deletedAt: null },
      },
      include: { course: { select: { code: true } } },
    });
    const mapped = new Set(offerings.map((o) => o.course.code));
    const missing = expected.filter((code) => !mapped.has(code));

    console.log(`\n=== ${dept.programCode} Direct Major/Internship ===`);
    if (missing.length) {
      totalMissing += missing.length;
      console.log(`MISSING ${missing.length}: ${missing.join(', ')}`);
    } else {
      console.log(`OK (${expected.length} papers)`);
    }

    const minors = [
      ...buildCommerceFyugpSem2MinorCourseDefs(dept.programCode).map(
        (c) => c.code,
      ),
      ...buildCommerceFyugpSem5MinorCourseDefs(dept.programCode).map(
        (c) => c.code,
      ),
    ];
    const minorOfferings = await prisma.courseOffering.findMany({
      where: {
        tenantId: tenant.id,
        programVersionId: versionId,
        mappingSource: 'DIRECT',
        category: 'MINOR',
        deletedAt: null,
      },
      include: { course: { select: { code: true } } },
    });
    const minorMapped = new Set(minorOfferings.map((o) => o.course.code));
    const minorMissing = minors.filter((code) => !minorMapped.has(code));

    console.log(`=== ${dept.programCode} Minor Slots ===`);
    if (minorMissing.length) {
      totalMissing += minorMissing.length;
      console.log(`MISSING ${minorMissing.length}: ${minorMissing.join(', ')}`);
    } else {
      console.log(`OK (${minors.length} slots)`);
    }
  }

  console.log(`\n=== Summary: ${totalMissing} gap(s) ===`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
