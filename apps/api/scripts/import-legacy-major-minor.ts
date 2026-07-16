/**
 * One-time import of legacy Major/Minor for pre-ERP Sem-3+ students.
 *
 * Reads a CSV produced by export-sem3-minor-collection-sheet.ts (or office-filled):
 *   rollNumber, enrollmentNumber, fullName, ..., majorDepartment, ..., minorDepartment
 *
 * Required columns (headers, case-insensitive):
 *   - rollNumber OR enrollmentNumber (at least one)
 *   - majorDepartment (or majorSubjectSlug)
 *   - minorDepartment (or minorSubjectSlug)
 *
 * Writes:
 *   1. student_program_choices MAJOR + MINOR (active)
 *   2. student_major_minor_tracks (synced from choices)
 *
 * Validates against major_minor_rules; non-matrix pairs are rejected unless
 * --allow-nonstandard is passed (still writes choices; use override seed separately
 * if eligibility must accept them).
 *
 * Usage (from apps/api):
 *   npx ts-node -r tsconfig-paths/register scripts/import-legacy-major-minor.ts --file=./sheet.csv --dry-run
 *   npx ts-node -r tsconfig-paths/register scripts/import-legacy-major-minor.ts --file=./sheet.csv
 *   npx ts-node -r tsconfig-paths/register scripts/import-legacy-major-minor.ts --file=./sheet.csv --tenant=demo --allow-nonstandard
 */
import * as fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { slugifySubject } from '../src/modules/academic-engine/domain/nep-categories';
import { syncMajorMinorTrackFromChoices } from '../src/modules/academic-engine/domain/student-major-minor-track.lock';

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

const dryRun = process.argv.includes('--dry-run');
const allowNonstandard = process.argv.includes('--allow-nonstandard');
const tenantSlug = readArg('tenant') ?? 'demo';
const filePath = readArg('file');
const prisma = new PrismaClient();

function normalizeLabel(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  const parseLine = (line: string): string[] => {
    const cells: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        cells.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    cells.push(cur.trim());
    return cells;
  };

  const headers = parseLine(lines[0]!).map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = parseLine(line);
    const row: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      row[headers[i]!] = cells[i] ?? '';
    }
    return row;
  });
}

function pick(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k.toLowerCase()]?.trim();
    if (v) return v;
  }
  return '';
}

type SubjectRow = {
  id: string;
  name: string;
  slug: string;
  departmentName: string | null;
};

async function loadSubjects(tenantId: string): Promise<SubjectRow[]> {
  const rows = await prisma.academicSubject.findMany({
    where: { tenantId, deletedAt: null, isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      department: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    departmentName: r.department?.name ?? null,
  }));
}

function resolveSubject(
  subjects: SubjectRow[],
  label: string,
): SubjectRow | null {
  const desired = normalizeLabel(label);
  const desiredSlug = slugifySubject(label);
  return (
    subjects.find((s) => normalizeLabel(s.name) === desired) ??
    subjects.find((s) => normalizeLabel(s.departmentName ?? '') === desired) ??
    subjects.find((s) => s.slug === desiredSlug) ??
    subjects.find((s) => normalizeLabel(s.slug) === desired) ??
    null
  );
}

async function upsertChoice(
  tenantId: string,
  studentId: string,
  choiceType: 'MAJOR' | 'MINOR',
  subjectSlug: string,
) {
  const existing = await prisma.studentProgramChoice.findFirst({
    where: {
      tenantId,
      studentId,
      choiceType,
      deletedAt: null,
    },
  });
  if (existing) {
    if (existing.subjectSlug === subjectSlug && existing.status === 'active') {
      return 'unchanged' as const;
    }
    await prisma.studentProgramChoice.update({
      where: { id: existing.id },
      data: { subjectSlug, status: 'active' },
    });
    return 'updated' as const;
  }
  await prisma.studentProgramChoice.create({
    data: {
      tenantId,
      studentId,
      choiceType,
      subjectSlug,
      status: 'active',
      effectiveFromSemester: 1,
    },
  });
  return 'created' as const;
}

async function main() {
  if (!filePath) {
    throw new Error(
      'Required: --file=path/to.csv (from export-sem3-minor-collection-sheet.ts)',
    );
  }
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const tenant = await prisma.tenant.findFirst({
    where: { slug: tenantSlug, deletedAt: null },
    select: { id: true, slug: true },
  });
  if (!tenant) throw new Error(`Tenant not found: ${tenantSlug}`);
  const tenantId = tenant.id;

  const subjects = await loadSubjects(tenantId);
  const rules = await prisma.majorMinorRule.findMany({
    where: { tenantId, isActive: true },
    select: {
      majorSubjectId: true,
      allowedMinorSubjectId: true,
    },
  });
  const allowedPairs = new Set(
    rules.map((r) => `${r.majorSubjectId}|${r.allowedMinorSubjectId}`),
  );

  const rows = parseCsv(fs.readFileSync(filePath, 'utf8'));
  console.log(
    `\nImport legacy major/minor — tenant=${tenant.slug} rows=${rows.length}` +
      `${dryRun ? '  (DRY RUN)' : ''}` +
      `${allowNonstandard ? '  (allow nonstandard pairs)' : ''}\n`,
  );

  const stats = {
    ok: 0,
    skippedEmpty: 0,
    studentNotFound: 0,
    subjectNotFound: 0,
    invalidPair: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
  };
  const errors: string[] = [];

  for (const row of rows) {
    const roll = pick(row, 'rollnumber', 'roll_number', 'college roll no');
    const enrollment = pick(
      row,
      'enrollmentnumber',
      'enrollment_number',
      'enrollment',
    );
    const majorLabel = pick(
      row,
      'majordepartment',
      'majorsubjectslug',
      'major',
      'major_subject',
    );
    const minorLabel = pick(
      row,
      'minordepartment',
      'minorsubjectslug',
      'minor',
      'minor_subject',
    );

    if (!majorLabel || !minorLabel) {
      stats.skippedEmpty++;
      continue;
    }
    if (!roll && !enrollment) {
      stats.skippedEmpty++;
      errors.push('Row missing rollNumber and enrollmentNumber');
      continue;
    }

    const student = await prisma.student.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          ...(roll
            ? [{ rollNumber: { equals: roll, mode: 'insensitive' as const } }]
            : []),
          ...(enrollment
            ? [
                {
                  enrollmentNumber: {
                    equals: enrollment,
                    mode: 'insensitive' as const,
                  },
                },
              ]
            : []),
        ],
      },
      select: {
        id: true,
        rollNumber: true,
        enrollmentNumber: true,
        majorMinorTrack: { select: { isTrackLocked: true } },
      },
    });
    if (!student) {
      stats.studentNotFound++;
      errors.push(`Student not found: ${roll || enrollment}`);
      continue;
    }

    const major = resolveSubject(subjects, majorLabel);
    const minor = resolveSubject(subjects, minorLabel);
    if (!major || !minor) {
      stats.subjectNotFound++;
      errors.push(
        `${student.rollNumber ?? student.enrollmentNumber}: subject not found` +
          ` major="${majorLabel}"→${major?.slug ?? '?'} minor="${minorLabel}"→${minor?.slug ?? '?'}`,
      );
      continue;
    }

    if (major.id === minor.id) {
      stats.invalidPair++;
      errors.push(
        `${student.rollNumber ?? student.enrollmentNumber}: major and minor cannot be the same (${major.name})`,
      );
      continue;
    }

    const inMatrix =
      allowedPairs.size === 0 || allowedPairs.has(`${major.id}|${minor.id}`);
    if (!inMatrix && !allowNonstandard) {
      stats.invalidPair++;
      errors.push(
        `${student.rollNumber ?? student.enrollmentNumber}: invalid pair ${major.name} / ${minor.name} (use --allow-nonstandard)`,
      );
      continue;
    }

    if (dryRun) {
      stats.ok++;
      stats.created++;
      continue;
    }

    const majorResult = await upsertChoice(
      tenantId,
      student.id,
      'MAJOR',
      major.slug,
    );
    const minorResult = await upsertChoice(
      tenantId,
      student.id,
      'MINOR',
      minor.slug,
    );

    if (student.majorMinorTrack?.isTrackLocked) {
      // Still update choices; unlock is not required for promotion filter.
      // Sync track only when unlocked so we don't fight locked rows.
      await prisma.studentMajorMinorTrack.update({
        where: { studentId: student.id },
        data: {
          majorSubjectId: major.id,
          minorSubjectId: minor.id,
        },
      });
    } else {
      await syncMajorMinorTrackFromChoices(prisma, tenantId, student.id);
    }

    stats.ok++;
    if (majorResult === 'created' || minorResult === 'created') stats.created++;
    else if (majorResult === 'updated' || minorResult === 'updated')
      stats.updated++;
    else stats.unchanged++;
  }

  console.log('Summary');
  console.log(JSON.stringify(stats, null, 2));
  if (errors.length) {
    console.log(`\nErrors (${errors.length}):`);
    for (const e of errors.slice(0, 40)) console.log(`  ${e}`);
    if (errors.length > 40) console.log(`  … and ${errors.length - 40} more`);
  }
  if (dryRun) console.log('\nDry run — no rows written.');

  if (stats.studentNotFound + stats.subjectNotFound + stats.invalidPair > 0) {
    process.exitCode = 2;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
