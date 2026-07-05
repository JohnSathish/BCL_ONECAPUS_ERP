import { PrismaClient } from '@prisma/client';
import { buildArtsFyugpEvenCourses } from '../src/modules/academic-engine/domain/arts-fyugp-even-catalog';
import { buildArtsFyugpOddCourses } from '../src/modules/academic-engine/domain/arts-fyugp-odd-catalog';
import { buildArtsFyugpSem2MinorCourseDefs } from '../src/modules/academic-engine/domain/arts-fyugp-even-catalog';
import { buildArtsFyugpSem5MinorCourseDefs } from '../src/modules/academic-engine/domain/arts-fyugp-odd-catalog';
import { ARTS_FYUGP_DEPARTMENTS } from '../src/modules/academic-engine/domain/arts-fyugp-odd-catalog';

const prisma = new PrismaClient();

const BA_PROGRAMS = ARTS_FYUGP_DEPARTMENTS.map((d) => d.programCode);

function expectedDirectCodes(programCode: string): string[] {
  const odd = buildArtsFyugpOddCourses().filter(
    (c) => c.programCode === programCode && !c.sharedPool,
  );
  const even = buildArtsFyugpEvenCourses().filter(
    (c) =>
      c.programCode === programCode &&
      (c.category === 'MAJOR' || c.category === 'INTERNSHIP'),
  );
  const sem2Major = even.filter(
    (c) => c.programCode === programCode && c.semesterSequence === 2,
  );
  const codes = new Set([
    ...odd.map((c) => c.code),
    ...sem2Major.map((c) => c.code),
    ...even
      .filter(
        (c) =>
          c.programCode === programCode &&
          (c.semesterSequence === 4 || c.semesterSequence === 6),
      )
      .map((c) => c.code),
  ]);
  return [...codes].sort();
}

function expectedMinorCodes(programCode: string): string[] {
  const sem2 = buildArtsFyugpSem2MinorCourseDefs(programCode).map(
    (c) => c.code,
  );
  const sem5 = buildArtsFyugpSem5MinorCourseDefs(programCode).map(
    (c) => c.code,
  );
  return [...new Set([...sem2, ...sem5])].sort();
}

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  if (!tenant) throw new Error('demo tenant not found');

  let totalMissing = 0;
  let totalExpected = 0;

  console.log('=== BA Programme Direct Major/Internship Offerings ===\n');

  for (const programCode of BA_PROGRAMS) {
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
    totalExpected += expected.length;

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

  for (const programCode of BA_PROGRAMS) {
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

  console.log('\n=== Shift Curriculum Pool Assignments (Sem 1–3) ===\n');

  const shifts = await prisma.shift.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
    select: { id: true, code: true },
  });
  const morning = shifts.find((s) => s.code === 'MORNING');
  const day = shifts.find((s) => s.code === 'DAY');

  for (const programCode of ['BA-ECO', 'BA-GEO'] as const) {
    const program = await prisma.program.findFirst({
      where: { tenantId: tenant.id, code: programCode, deletedAt: null },
      include: {
        versions: { where: { deletedAt: null, version: 1 }, take: 1 },
      },
    });
    const versionId = program?.versions[0]?.id;
    if (!versionId) continue;

    for (const [shiftLabel, shiftId, semesters] of [
      ['Morning', morning?.id, [1, 2, 3]],
      ['Day', day?.id, [1, 2]],
    ] as const) {
      if (!shiftId) continue;
      for (const sem of semesters) {
        const count = await prisma.programmePoolAssignment.count({
          where: {
            tenantId: tenant.id,
            programVersionId: versionId,
            semesterNo: sem,
            shiftId,
          },
        });
        console.log(
          `${programCode} ${shiftLabel} Sem ${sem}: ${count} pool assignment(s) ${count > 0 ? 'OK' : 'MISSING'}`,
        );
        if (count === 0) totalMissing += 1;
      }
    }
  }

  console.log(
    `\n=== Summary: ${totalMissing} gap(s) vs ${totalExpected}+ expected direct mappings ===`,
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
