/**
 * Fix Garo department students imported under BA-GEO instead of BA-GAR.
 *
 * Usage:
 *   node scripts/fix-garo-programme.mjs           # dry run
 *   node scripts/fix-garo-programme.mjs --apply   # commit changes
 */
import { PrismaClient } from '@prisma/client';

const APPLY = process.argv.includes('--apply');

const ROLL_NUMBERS = [
  'BA25-035',
  'BA25-046',
  'BA25-052',
  'BA25-057',
  'BA25-089',
  'BA25-091',
  'BA25-095',
  'BA25-099',
  'BA25-104',
  'BA25-123',
  'BA25-128',
  'BA25-143',
  'BA25-154',
  'BA25-177',
  'BA25-200',
  'BA25-203',
  'BA25-205',
  'BA25-207',
  'BA25-210',
  'BA25-212',
  'BA25-217',
  'BA25-219',
  'BA25-230',
  'BA25-236',
  'BA25-237',
  'BA25-242',
  'BA25-284',
  'BA25-298',
  'BA25-302',
  'BA25-306',
  'BA25-324',
  'BA25-325',
  'BA25-332',
  'BA25-338',
  'BA25-344',
  'BA25-352',
  'BA25-359',
  'BA25-366',
  'BA25-396',
  'BA25-399',
  'BA25-414',
  'BA25-425',
];

const BA_GAR_PROGRAM_CODE = 'BA-GAR';
const BA_GEO_PROGRAM_CODE = 'BA-GEO';
const GARO_MAJOR_SLUG = 'garo';
const SEMESTER_SEQUENCE = 3;

const p = new PrismaClient();

async function main() {
  const garVersion = await p.programVersion.findFirst({
    where: { program: { code: BA_GAR_PROGRAM_CODE } },
    orderBy: { version: 'desc' },
    select: { id: true, program: { select: { code: true } } },
  });
  if (!garVersion) {
    throw new Error(`Programme ${BA_GAR_PROGRAM_CODE} not found`);
  }

  const garMajorOfferings = await p.courseOffering.findMany({
    where: {
      programVersionId: garVersion.id,
      category: 'MAJOR',
      semesterSequence: SEMESTER_SEQUENCE,
    },
    orderBy: { course: { code: 'asc' } },
    select: {
      id: true,
      category: true,
      course: { select: { code: true, title: true } },
    },
  });

  if (garMajorOfferings.length < 2) {
    throw new Error(
      `Expected at least 2 BA-GAR Sem ${SEMESTER_SEQUENCE} major offerings, found ${garMajorOfferings.length}`,
    );
  }

  console.log(
    APPLY ? '=== APPLY MODE ===' : '=== DRY RUN (pass --apply to commit) ===',
  );
  console.log(
    `Target programme: ${garVersion.program.code} (${garVersion.id})`,
  );
  console.log(
    'Target major papers:',
    garMajorOfferings.map((o) => o.course.code).join(', '),
  );

  let updated = 0;
  let skipped = 0;
  const issues = [];

  for (const rollNumber of ROLL_NUMBERS) {
    const student = await p.student.findFirst({
      where: { rollNumber, deletedAt: null },
      include: {
        department: { select: { code: true } },
        programVersion: { include: { program: { select: { code: true } } } },
        programChoices: {
          where: { choiceType: 'MAJOR', deletedAt: null, status: 'active' },
        },
        semesterRegistrations: {
          where: { semesterSequence: SEMESTER_SEQUENCE },
          include: {
            lines: {
              include: {
                offering: { include: { course: { select: { code: true } } } },
              },
            },
          },
        },
      },
    });

    if (!student) {
      issues.push(`${rollNumber}: student not found`);
      skipped += 1;
      continue;
    }

    if (student.department?.code !== 'GAR') {
      issues.push(
        `${rollNumber}: department is ${student.department?.code ?? 'none'}, expected GAR`,
      );
      skipped += 1;
      continue;
    }

    const currentProgram = student.programVersion?.program.code;
    if (currentProgram === BA_GAR_PROGRAM_CODE) {
      console.log(`${rollNumber}: already on ${BA_GAR_PROGRAM_CODE} — skip`);
      skipped += 1;
      continue;
    }

    if (currentProgram !== BA_GEO_PROGRAM_CODE) {
      issues.push(
        `${rollNumber}: programme is ${currentProgram ?? 'none'}, expected ${BA_GEO_PROGRAM_CODE}`,
      );
      skipped += 1;
      continue;
    }

    const registration = student.semesterRegistrations[0];
    const majorLines =
      registration?.lines.filter((l) => l.category === 'MAJOR') ?? [];
    const otherLines =
      registration?.lines.filter((l) => l.category !== 'MAJOR') ?? [];

    console.log(`\n${rollNumber}:`);
    console.log(`  programme: ${currentProgram} -> ${BA_GAR_PROGRAM_CODE}`);
    console.log(
      `  major choice: ${student.programChoices[0]?.subjectSlug ?? 'none'} -> ${GARO_MAJOR_SLUG}`,
    );
    console.log(
      `  sem${SEMESTER_SEQUENCE} major papers: ${majorLines.map((l) => l.offering.course.code).join(', ') || 'none'} -> ${garMajorOfferings.map((o) => o.course.code).join(', ')}`,
    );
    console.log(
      `  keeping ${otherLines.length} non-major registration line(s) (MDC/AEC/SEC/VTC etc.)`,
    );

    if (!APPLY) {
      updated += 1;
      continue;
    }

    await p.$transaction(async (tx) => {
      await tx.student.update({
        where: { id: student.id },
        data: { programVersionId: garVersion.id },
      });

      const majorChoice = student.programChoices[0];
      if (majorChoice) {
        await tx.studentProgramChoice.update({
          where: { id: majorChoice.id },
          data: { subjectSlug: GARO_MAJOR_SLUG },
        });
      } else {
        await tx.studentProgramChoice.create({
          data: {
            tenantId: student.tenantId,
            studentId: student.id,
            choiceType: 'MAJOR',
            subjectSlug: GARO_MAJOR_SLUG,
            departmentId: student.departmentId,
            status: 'active',
            effectiveFromSemester: 1,
          },
        });
      }

      if (registration) {
        await tx.semesterRegistrationLine.deleteMany({
          where: {
            registrationId: registration.id,
            category: 'MAJOR',
          },
        });

        for (const [index, offering] of garMajorOfferings.entries()) {
          await tx.semesterRegistrationLine.create({
            data: {
              tenantId: student.tenantId,
              registrationId: registration.id,
              offeringId: offering.id,
              category: 'MAJOR',
              status: 'pending',
              priorityRank: index + 1,
              assignmentSource: 'DIRECT',
              registrationSource: 'ADMIN_CORRECTION',
              generatedBy: 'FIX_GARO_PROGRAMME_SCRIPT',
            },
          });
        }
      }
    });

    updated += 1;
  }

  console.log('\n=== Summary ===');
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  if (issues.length) {
    console.log('Issues:');
    for (const issue of issues) console.log(`  - ${issue}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await p.$disconnect();
  });
