import { PrismaClient } from '@prisma/client';
import { looksLikeCourseCode } from '../src/common/validation/program-code.validation';

const prisma = new PrismaClient();

async function inspectProgram(code: string) {
  const program = await prisma.program.findFirst({
    where: { code, deletedAt: null },
    include: {
      versions: { where: { deletedAt: null }, orderBy: { version: 'asc' } },
      department: { select: { code: true, name: true } },
    },
  });
  if (!program) {
    console.log(`No active program: ${code}`);
    return null;
  }
  console.log('\nPROGRAM', {
    id: program.id,
    code: program.code,
    name: program.name,
    department: program.department,
    looksLikeCourse: looksLikeCourseCode(program.code),
    versions: program.versions.map((v) => ({
      id: v.id,
      version: v.version,
      status: v.status,
    })),
  });
  for (const v of program.versions) {
    const [offerings, students, registrations, pools, rules, sections] =
      await Promise.all([
        prisma.courseOffering.count({
          where: { programVersionId: v.id, deletedAt: null },
        }),
        prisma.student.count({
          where: { programVersionId: v.id, deletedAt: null },
        }),
        prisma.registration.count({
          where: {
            deletedAt: null,
            offering: { programVersionId: v.id, deletedAt: null },
          },
        }),
        prisma.programmePoolAssignment.count({
          where: { programVersionId: v.id, active: true },
        }),
        prisma.semesterStructureRule.count({
          where: { programVersionId: v.id },
        }),
        prisma.offeringSection.count({
          where: {
            deletedAt: null,
            courseOffering: { programVersionId: v.id, deletedAt: null },
          },
        }),
      ]);
    console.log(`  v${v.version} usage`, {
      offerings,
      students,
      registrations,
      pools,
      rules,
      sections,
    });
  }
  return program;
}

async function main() {
  const all = await prisma.program.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      code: true,
      name: true,
      level: true,
      departmentId: true,
    },
    orderBy: { code: 'asc' },
  });
  console.log(
    'Suspicious programmes (course-code pattern or missing department):',
  );
  for (const p of all) {
    if (looksLikeCourseCode(p.code) || !p.departmentId) {
      console.log(' ', p);
    }
  }

  for (const code of ['ECO-100', 'EVS']) {
    await inspectProgram(code);
  }

  const deleted = await prisma.program.findMany({
    where: { code: { in: ['ECO-100', 'EVS'] } },
    select: { id: true, code: true, name: true, deletedAt: true },
  });
  console.log('\nSoft-deleted matches:', deleted);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
