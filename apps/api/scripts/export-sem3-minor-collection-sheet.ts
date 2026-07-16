/**
 * Export Sem-3 (and optionally Sem-4+) students as a CSV for the college office
 * to fill in legacy Minor department names (pre-ERP admissions).
 *
 * Columns:
 *   rollNumber, enrollmentNumber, fullName, programme, majorDepartment,
 *   existingMinorSlug, minorDepartment
 *
 * `minorDepartment` is left blank when the ERP has no MINOR program choice —
 * that is the column the office fills from Sem 1/2 registers.
 *
 * Usage (from apps/api):
 *   npx ts-node -r tsconfig-paths/register scripts/export-sem3-minor-collection-sheet.ts
 *   npx ts-node -r tsconfig-paths/register scripts/export-sem3-minor-collection-sheet.ts --sem=3 --out=./sem3-minor-sheet.csv
 *   npx ts-node -r tsconfig-paths/register scripts/export-sem3-minor-collection-sheet.ts --tenant=demo --missing-only
 */
import * as fs from 'fs';
import * as path from 'path';
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
const missingOnly = process.argv.includes('--missing-only');
const includeDemo = process.argv.includes('--include-demo');
const outPath =
  readArg('out') ??
  path.join(
    process.cwd(),
    `legacy-minor-collection-sem${semMin}-${new Date().toISOString().slice(0, 10)}.csv`,
  );
const prisma = new PrismaClient();

function isDemoStudent(s: {
  enrollmentNumber: string;
  rollNumber: string | null;
}): boolean {
  const en = s.enrollmentNumber.toUpperCase();
  const roll = (s.rollNumber ?? '').toUpperCase();
  return (
    en.startsWith('DEMO-') ||
    roll.startsWith('ARTS25') ||
    roll.startsWith('DEMO')
  );
}

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
        lifecycleState: { not: 'ALUMNI' },
      },
    },
    select: {
      id: true,
      rollNumber: true,
      enrollmentNumber: true,
      programVersion: {
        select: { program: { select: { name: true, code: true } } },
      },
      masterProfile: { select: { fullName: true } },
      user: { select: { displayName: true } },
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
    orderBy: [{ rollNumber: 'asc' }, { enrollmentNumber: 'asc' }],
  });

  const header = [
    'rollNumber',
    'enrollmentNumber',
    'fullName',
    'semester',
    'programme',
    'majorDepartment',
    'existingMinorSlug',
    'minorDepartment',
  ];

  const rows: string[][] = [];
  let missingMinor = 0;

  for (const s of students) {
    if (!includeDemo && isDemoStudent(s)) continue;

    const majorChoice = s.programChoices.find((c) => c.choiceType === 'MAJOR');
    const minorChoice = s.programChoices.find((c) => c.choiceType === 'MINOR');
    const existingMinor =
      minorChoice?.subjectSlug ?? s.majorMinorTrack?.minorSubject?.slug ?? '';
    if (missingOnly && existingMinor) continue;
    if (!existingMinor) missingMinor++;

    const majorDepartment =
      s.majorMinorTrack?.majorSubject?.name ??
      majorChoice?.subjectSlug ??
      s.programVersion?.program?.name?.replace(/^FYUP in\s+/i, '') ??
      '';

    const fullName =
      s.masterProfile?.fullName?.trim() || s.user?.displayName?.trim() || '';

    rows.push([
      s.rollNumber ?? '',
      s.enrollmentNumber,
      fullName,
      String(s.academicStanding?.currentSemesterSequence ?? ''),
      s.programVersion?.program?.name ?? s.programVersion?.program?.code ?? '',
      majorDepartment,
      existingMinor,
      // Blank for office to fill when missing; pre-fill name if already known
      existingMinor
        ? (s.majorMinorTrack?.minorSubject?.name ?? existingMinor)
        : '',
    ]);
  }

  const lines = [
    header.join(','),
    ...rows.map((r) => r.map(csvEscape).join(',')),
  ];
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');

  console.log(`\nExport Sem-${semMin}+ minor collection sheet`);
  console.log(`  Tenant: ${tenant.slug}`);
  console.log(`  Students written: ${rows.length}`);
  console.log(`  Missing minor (blank minorDepartment): ${missingMinor}`);
  console.log(`  File: ${outPath}`);
  console.log(
    `\nAsk the college office to fill minorDepartment (e.g. Education, Political Science)`,
  );
  console.log(
    `then import with: scripts/import-legacy-major-minor.ts --file=<path>`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
