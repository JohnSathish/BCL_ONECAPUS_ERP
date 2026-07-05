/**
 * Backfill student_major_minor_tracks for imported students (demo tenant by default).
 *
 * Priority:
 *   1. Active MAJOR/MINOR program choices (student_program_choices)
 *   2. Programme name — "FYUP in Philosophy" → academic subject slug philosophy
 *   3. Student department → academic subject on that department
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/backfill-major-minor-tracks.ts
 *   npx ts-node -r tsconfig-paths/register scripts/backfill-major-minor-tracks.ts --dry-run
 *   npx ts-node -r tsconfig-paths/register scripts/backfill-major-minor-tracks.ts --tenant=demo
 */
import { PrismaClient } from '@prisma/client';
import { slugifySubject } from '../src/modules/academic-engine/domain/nep-categories';
import { syncMajorMinorTrackFromChoices } from '../src/modules/academic-engine/domain/student-major-minor-track.lock';

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

const dryRun = process.argv.includes('--dry-run');
const tenantSlug = readArg('tenant') ?? 'demo';

const prisma = new PrismaClient();

type BackfillSource = 'program_choice' | 'programme' | 'department';

type ResolvedTrack = {
  studentId: string;
  rollNumber: string | null;
  majorSubjectId: string;
  minorSubjectId: string | null;
  source: BackfillSource;
  label: string;
};

function subjectSlugFromProgrammeName(programmeName: string): string | null {
  const match = programmeName.match(/^FYUP in\s+(.+)$/i);
  if (!match?.[1]) return null;
  return slugifySubject(match[1].trim());
}

async function resolveSubjectBySlug(
  tenantId: string,
  institutionId: string,
  slug: string,
) {
  return prisma.academicSubject.findFirst({
    where: {
      tenantId,
      institutionId,
      slug: slugifySubject(slug),
      deletedAt: null,
      isActive: true,
    },
    select: { id: true, name: true, slug: true },
  });
}

async function resolveSubjectByDepartment(
  tenantId: string,
  departmentId: string,
  institutionId?: string | null,
) {
  return prisma.academicSubject.findFirst({
    where: {
      tenantId,
      departmentId,
      deletedAt: null,
      isActive: true,
      ...(institutionId ? { institutionId } : {}),
    },
    select: { id: true, name: true, slug: true },
    orderBy: { name: 'asc' },
  });
}

async function resolveFromProgramme(
  tenantId: string,
  institutionId: string,
  programmeName: string,
): Promise<{ id: string; name: string } | null> {
  const slug = subjectSlugFromProgrammeName(programmeName);
  if (!slug) return null;
  return resolveSubjectBySlug(tenantId, institutionId, slug);
}

type StudentRow = {
  id: string;
  rollNumber: string | null;
  departmentId: string | null;
  majorMinorTrack: { id: string; majorSubjectId: string } | null;
  programChoices: Array<{ choiceType: string; subjectSlug: string | null }>;
  programVersion: {
    program: {
      name: string;
      department: { institutionId: string } | null;
    };
  } | null;
  department: { name: string; institutionId: string } | null;
};

async function loadStudents(tenantId: string): Promise<StudentRow[]> {
  return prisma.student.findMany({
    where: { tenantId, deletedAt: null },
    select: {
      id: true,
      rollNumber: true,
      departmentId: true,
      majorMinorTrack: { select: { id: true, majorSubjectId: true } },
      programChoices: {
        where: { status: 'active', deletedAt: null },
        select: { choiceType: true, subjectSlug: true },
      },
      programVersion: {
        select: {
          program: {
            select: {
              name: true,
              department: { select: { institutionId: true } },
            },
          },
        },
      },
      department: { select: { name: true, institutionId: true } },
    },
    orderBy: { rollNumber: 'asc' },
  }) as Promise<StudentRow[]>;
}

async function resolveTrack(
  tenantId: string,
  institutionFallbackId: string | null,
  student: StudentRow,
): Promise<ResolvedTrack | null> {
  const institutionId =
    student.programVersion?.program?.department?.institutionId ??
    student.department?.institutionId ??
    institutionFallbackId;

  const majorChoice = student.programChoices.find(
    (c) => c.choiceType === 'MAJOR' && c.subjectSlug,
  );
  const minorChoice = student.programChoices.find(
    (c) => c.choiceType === 'MINOR' && c.subjectSlug,
  );

  if (majorChoice?.subjectSlug && institutionId) {
    const major = await resolveSubjectBySlug(
      tenantId,
      institutionId,
      majorChoice.subjectSlug,
    );
    if (major) {
      const minor = minorChoice?.subjectSlug
        ? await resolveSubjectBySlug(
            tenantId,
            institutionId,
            minorChoice.subjectSlug,
          )
        : null;
      return {
        studentId: student.id,
        rollNumber: student.rollNumber,
        majorSubjectId: major.id,
        minorSubjectId: minor?.id ?? null,
        source: 'program_choice',
        label: `${major.name}${minor ? ` / ${minor.name}` : ''}`,
      };
    }
  }

  const programmeName = student.programVersion?.program?.name;
  if (programmeName && institutionId) {
    const major = await resolveFromProgramme(
      tenantId,
      institutionId,
      programmeName,
    );
    if (major) {
      return {
        studentId: student.id,
        rollNumber: student.rollNumber,
        majorSubjectId: major.id,
        minorSubjectId: null,
        source: 'programme',
        label: `${major.name} (from ${programmeName})`,
      };
    }
  }

  if (student.departmentId) {
    const major = await resolveSubjectByDepartment(
      tenantId,
      student.departmentId,
      institutionId,
    );
    if (major) {
      return {
        studentId: student.id,
        rollNumber: student.rollNumber,
        majorSubjectId: major.id,
        minorSubjectId: null,
        source: 'department',
        label: `${major.name} (from department ${student.department?.name ?? ''})`,
      };
    }
  }

  return null;
}

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: tenantSlug, deletedAt: null },
    select: { id: true, slug: true, name: true },
  });
  if (!tenant) {
    throw new Error(`Tenant not found: ${tenantSlug}`);
  }

  console.log(
    `Backfill major/minor tracks — tenant=${tenant.slug}${dryRun ? ' (DRY RUN)' : ''}`,
  );

  const defaultInstitution = await prisma.institution.findFirst({
    where: { tenantId: tenant.id, deletedAt: null },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  });
  if (defaultInstitution) {
    console.log(`Institution fallback: ${defaultInstitution.name}`);
  }

  const students = await loadStudents(tenant.id);
  const stats = {
    total: students.length,
    alreadyHadTrack: 0,
    created: 0,
    updated: 0,
    skippedLocked: 0,
    unresolved: 0,
    bySource: { program_choice: 0, programme: 0, department: 0 } as Record<
      BackfillSource,
      number
    >,
  };
  const unresolvedRolls: string[] = [];
  const samples: ResolvedTrack[] = [];

  for (const student of students) {
    if (student.majorMinorTrack) {
      stats.alreadyHadTrack++;
      continue;
    }

    const resolved = await resolveTrack(
      tenant.id,
      defaultInstitution?.id ?? null,
      student,
    );
    if (!resolved) {
      stats.unresolved++;
      if (student.rollNumber) unresolvedRolls.push(student.rollNumber);
      continue;
    }

    stats.bySource[resolved.source]++;

    if (samples.length < 5) samples.push(resolved);

    if (dryRun) {
      stats.created++;
      continue;
    }

    const existing = await prisma.studentMajorMinorTrack.findUnique({
      where: { studentId: student.id },
      select: { id: true, isTrackLocked: true },
    });

    if (existing?.isTrackLocked) {
      stats.skippedLocked++;
      continue;
    }

    if (resolved.source === 'program_choice') {
      const synced = await syncMajorMinorTrackFromChoices(
        prisma,
        tenant.id,
        student.id,
      );
      if (synced) {
        if (existing) stats.updated++;
        else stats.created++;
        continue;
      }
    }

    await prisma.studentMajorMinorTrack.upsert({
      where: { studentId: student.id },
      create: {
        tenantId: tenant.id,
        studentId: student.id,
        majorSubjectId: resolved.majorSubjectId,
        minorSubjectId: resolved.minorSubjectId,
      },
      update: {
        majorSubjectId: resolved.majorSubjectId,
        minorSubjectId: resolved.minorSubjectId,
      },
    });
    if (existing) stats.updated++;
    else stats.created++;
  }

  const trackCount = await prisma.studentMajorMinorTrack.count({
    where: { tenantId: tenant.id },
  });

  const phil = await prisma.academicSubject.findFirst({
    where: { tenantId: tenant.id, slug: 'philosophy', deletedAt: null },
    select: { id: true },
  });
  const philCount = phil
    ? await prisma.studentMajorMinorTrack.count({
        where: { tenantId: tenant.id, majorSubjectId: phil.id },
      })
    : 0;

  console.log('\nSummary');
  console.log(
    JSON.stringify(
      { ...stats, trackRowsNow: trackCount, philosophyMajors: philCount },
      null,
      2,
    ),
  );
  if (samples.length) {
    console.log('\nSample resolutions:');
    for (const s of samples) {
      console.log(`  ${s.rollNumber ?? s.studentId}: ${s.label} [${s.source}]`);
    }
  }
  if (unresolvedRolls.length) {
    console.log(
      `\nUnresolved (${unresolvedRolls.length}): ${unresolvedRolls.slice(0, 20).join(', ')}${unresolvedRolls.length > 20 ? '…' : ''}`,
    );
  }
  if (dryRun) {
    console.log(
      '\nDry run — no rows written. Re-run without --dry-run to apply.',
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
