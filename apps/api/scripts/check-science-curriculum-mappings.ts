import { PrismaClient } from '@prisma/client';
import { buildScienceFyugpEvenCourses } from '../src/modules/academic-engine/domain/science-fyugp-even-catalog';
import { buildScienceFyugpOddCourses } from '../src/modules/academic-engine/domain/science-fyugp-odd-catalog';
import {
  buildScienceFyugpSem2MinorCourseDefs,
  buildScienceFyugpSem5MinorCourseDefs,
} from '../src/modules/academic-engine/domain/science-fyugp-even-catalog';
import { SCIENCE_FYUGP_DEPARTMENTS } from '../src/modules/academic-engine/domain/science-fyugp-odd-catalog';

const prisma = new PrismaClient();

const SCIENCE_PROGRAMS = SCIENCE_FYUGP_DEPARTMENTS.map((d) => d.programCode);

function expectedDirectCodes(programCode: string): string[] {
  const odd = buildScienceFyugpOddCourses().filter(
    (c) => c.programCode === programCode,
  );
  const even = buildScienceFyugpEvenCourses().filter(
    (c) =>
      c.programCode === programCode &&
      (c.category === 'MAJOR' || c.category === 'INTERNSHIP'),
  );
  const codes = new Set([
    ...odd.map((c) => c.code),
    ...even
      .filter(
        (c) =>
          c.programCode === programCode &&
          (c.semesterSequence === 2 ||
            c.semesterSequence === 4 ||
            c.semesterSequence === 6),
      )
      .map((c) => c.code),
  ]);
  return [...codes].sort();
}

function expectedMinorCodes(programCode: string): string[] {
  const sem2 = buildScienceFyugpSem2MinorCourseDefs(programCode).map(
    (c) => c.code,
  );
  const sem5 = buildScienceFyugpSem5MinorCourseDefs(programCode).map(
    (c) => c.code,
  );
  return [...new Set([...sem2, ...sem5])].sort();
}

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  if (!tenant) throw new Error('demo tenant not found');

  let totalMissing = 0;

  console.log('=== B.Sc Programme Direct Major/Internship Offerings ===\n');

  for (const programCode of SCIENCE_PROGRAMS) {
    const program = await prisma.program.findFirst({
      where: { tenantId: tenant.id, code: programCode, deletedAt: null },
      include: {
        versions: { where: { deletedAt: null, version: 1 }, take: 1 },
      },
    });
    if (!program?.versions[0]) {
      console.log(`${programCode}: MISSING programme version`);
      continue;
    }
    const versionId = program.versions[0].id;
    const expected = expectedDirectCodes(programCode);

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

    if (missing.length) {
      totalMissing += missing.length;
      console.log(`${programCode}: MISSING ${missing.length} direct offerings`);
      for (const code of missing) console.log(`  - ${code}`);
    } else {
      console.log(
        `${programCode}: OK (${expected.length} direct major/internship papers)`,
      );
    }
  }

  console.log('\n=== Cross-Department Minor Offerings (Sem 2 + Sem 5) ===\n');

  for (const programCode of SCIENCE_PROGRAMS) {
    const program = await prisma.program.findFirst({
      where: { tenantId: tenant.id, code: programCode, deletedAt: null },
      include: {
        versions: { where: { deletedAt: null, version: 1 }, take: 1 },
      },
    });
    if (!program?.versions[0]) continue;
    const versionId = program.versions[0].id;
    const expected = expectedMinorCodes(programCode);

    const offerings = await prisma.courseOffering.findMany({
      where: {
        tenantId: tenant.id,
        programVersionId: versionId,
        mappingSource: 'DIRECT',
        category: 'MINOR',
        deletedAt: null,
      },
      include: { course: { select: { code: true } } },
    });
    const mapped = new Set(offerings.map((o) => o.course.code));
    const missing = expected.filter((code) => !mapped.has(code));

    if (missing.length) {
      totalMissing += missing.length;
      console.log(`${programCode}: MISSING ${missing.length} minor offerings`);
      for (const code of missing) console.log(`  - ${code}`);
    } else {
      console.log(`${programCode}: OK (${expected.length} minor slots)`);
    }
  }

  console.log(`\n=== Summary: ${totalMissing} gap(s) ===`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
