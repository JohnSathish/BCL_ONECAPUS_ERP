/**
 * Report Sem-3+ students who have MAJOR (or a major track) but no active MINOR
 * program choice — these will break Sem 4→5 / 6→7 Minor auto-assign.
 *
 * Usage (from apps/api):
 *   npx ts-node -r tsconfig-paths/register scripts/report-missing-minor-choices.ts
 *   npx ts-node -r tsconfig-paths/register scripts/report-missing-minor-choices.ts --sem=3 --tenant=demo
 *   npx ts-node -r tsconfig-paths/register scripts/report-missing-minor-choices.ts --out=./missing-minors.csv
 */
import * as fs from 'fs';
import { PrismaClient } from '@prisma/client';

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

const tenantSlug = readArg('tenant') ?? 'demo';
const semMin = Number(readArg('sem') ?? '3');
const outPath = readArg('out');
const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: tenantSlug, deletedAt: null },
    select: { id: true, slug: true },
  });
  if (!tenant) throw new Error(`Tenant not found: ${tenantSlug}`);

  const students = await prisma.student.findMany({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      academicStanding: {
        currentSemesterSequence: { gte: semMin },
      },
    },
    select: {
      rollNumber: true,
      enrollmentNumber: true,
      masterProfile: { select: { fullName: true } },
      programVersion: { select: { program: { select: { name: true } } } },
      programChoices: {
        where: { status: 'active', deletedAt: null },
        select: { choiceType: true, subjectSlug: true },
      },
      majorMinorTrack: {
        select: {
          majorSubject: { select: { name: true, slug: true } },
          minorSubject: { select: { name: true, slug: true } },
        },
      },
      academicStanding: { select: { currentSemesterSequence: true } },
    },
    orderBy: [{ rollNumber: 'asc' }],
  });

  const missing: {
    roll: string;
    enrollment: string;
    name: string;
    sem: number;
    programme: string;
    major: string;
    hasMajorChoice: boolean;
    hasTrackMinor: boolean;
  }[] = [];

  let hasMajorNoMinor = 0;
  let noMajorNoMinor = 0;

  for (const s of students) {
    const majorChoice = s.programChoices.find((c) => c.choiceType === 'MAJOR');
    const minorChoice = s.programChoices.find((c) => c.choiceType === 'MINOR');
    const trackMinor = s.majorMinorTrack?.minorSubject;
    if (minorChoice?.subjectSlug) continue;

    const major =
      s.majorMinorTrack?.majorSubject?.name ??
      majorChoice?.subjectSlug ??
      s.programVersion?.program?.name ??
      '';

    if (majorChoice || s.majorMinorTrack?.majorSubject) hasMajorNoMinor++;
    else noMajorNoMinor++;

    missing.push({
      roll: s.rollNumber ?? '',
      enrollment: s.enrollmentNumber,
      name: s.masterProfile?.fullName ?? '',
      sem: s.academicStanding?.currentSemesterSequence ?? 0,
      programme: s.programVersion?.program?.name ?? '',
      major,
      hasMajorChoice: Boolean(majorChoice),
      hasTrackMinor: Boolean(trackMinor),
    });
  }

  console.log(
    `\nMissing MINOR program choices — tenant=${tenant.slug} sem>=${semMin}`,
  );
  console.log(`  Total students scanned: ${students.length}`);
  console.log(`  Missing MINOR choice: ${missing.length}`);
  console.log(`    with MAJOR present: ${hasMajorNoMinor}`);
  console.log(`    without MAJOR either: ${noMajorNoMinor}`);
  console.log(
    `  Note: track.minorSubject without program choice still counts as missing`,
  );
  console.log(`        (promotion auto-assign reads StudentProgramChoice).\n`);

  const sample = missing.slice(0, 25);
  for (const m of sample) {
    console.log(
      `  ${m.roll || m.enrollment}  Sem${m.sem}  major=${m.major || '—'}  ${m.name}`,
    );
  }
  if (missing.length > sample.length) {
    console.log(`  … and ${missing.length - sample.length} more`);
  }

  if (outPath) {
    const lines = [
      'rollNumber,enrollmentNumber,fullName,semester,programme,majorDepartment',
      ...missing.map((m) =>
        [m.roll, m.enrollment, m.name, String(m.sem), m.programme, m.major]
          .map(csvEscape)
          .join(','),
      ),
    ];
    fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
    console.log(`\nWrote ${outPath}`);
  }

  if (missing.length > 0) process.exitCode = 2;
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
