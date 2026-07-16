/**
 * Verify Sem-3+ students are ready for a future Sem 4→5 promotion that
 * requires MINOR LOCK continuity via StudentProgramChoice (Sem 4 has no Minor).
 *
 * Checks:
 *   - active MINOR program choice
 *   - student_major_minor_tracks.minorSubjectId present
 *   - major/minor pair exists in major_minor_rules (or --allow-nonstandard)
 *   - sample: Sem-5 MINOR offerings exist for that minor subject path
 *
 * Usage (from apps/api):
 *   npx ts-node -r tsconfig-paths/register scripts/verify-legacy-minor-promotion-ready.ts
 *   npx ts-node -r tsconfig-paths/register scripts/verify-legacy-minor-promotion-ready.ts --sem=3 --limit=20
 */
import { PrismaClient } from '@prisma/client';
import { courseMatchesSubjectPath } from '../src/modules/academic-engine/domain/course-subject-slug';

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

const tenantSlug = readArg('tenant') ?? 'demo';
const semMin = Number(readArg('sem') ?? '3');
const limit = Number(readArg('limit') ?? '15');
const allowNonstandard = process.argv.includes('--allow-nonstandard');
const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: tenantSlug, deletedAt: null },
    select: { id: true, slug: true },
  });
  if (!tenant) throw new Error(`Tenant not found: ${tenantSlug}`);
  const tenantId = tenant.id;

  const rules = await prisma.majorMinorRule.findMany({
    where: { tenantId, isActive: true },
    select: { majorSubjectId: true, allowedMinorSubjectId: true },
  });
  const allowedPairs = new Set(
    rules.map((r) => `${r.majorSubjectId}|${r.allowedMinorSubjectId}`),
  );

  const students = await prisma.student.findMany({
    where: {
      tenantId,
      deletedAt: null,
      academicStanding: { currentSemesterSequence: { gte: semMin } },
    },
    select: {
      id: true,
      rollNumber: true,
      enrollmentNumber: true,
      programVersionId: true,
      programChoices: {
        where: { status: 'active', deletedAt: null },
        select: { choiceType: true, subjectSlug: true },
      },
      majorMinorTrack: {
        select: {
          majorSubjectId: true,
          minorSubjectId: true,
          majorSubject: { select: { name: true, slug: true } },
          minorSubject: { select: { name: true, slug: true } },
        },
      },
    },
    orderBy: { rollNumber: 'asc' },
  });

  const stats = {
    total: students.length,
    ready: 0,
    missingMinorChoice: 0,
    missingTrackMinor: 0,
    invalidPair: 0,
    noSem5MinorOffering: 0,
  };
  const problems: string[] = [];
  const readySamples: string[] = [];

  for (const s of students) {
    const majorChoice = s.programChoices.find((c) => c.choiceType === 'MAJOR');
    const minorChoice = s.programChoices.find((c) => c.choiceType === 'MINOR');
    const label = s.rollNumber ?? s.enrollmentNumber;

    if (!minorChoice?.subjectSlug) {
      stats.missingMinorChoice++;
      problems.push(`${label}: no MINOR program choice`);
      continue;
    }
    if (!s.majorMinorTrack?.minorSubjectId) {
      stats.missingTrackMinor++;
      problems.push(
        `${label}: has MINOR choice (${minorChoice.subjectSlug}) but track.minorSubjectId is null — run backfill-major-minor-tracks`,
      );
      continue;
    }

    const majorId = s.majorMinorTrack.majorSubjectId;
    const minorId = s.majorMinorTrack.minorSubjectId;
    if (
      allowedPairs.size > 0 &&
      !allowedPairs.has(`${majorId}|${minorId}`) &&
      !allowNonstandard
    ) {
      stats.invalidPair++;
      problems.push(
        `${label}: pair ${s.majorMinorTrack.majorSubject?.name} / ${s.majorMinorTrack.minorSubject?.name} not in matrix`,
      );
      continue;
    }

    // Spot-check: at least one Sem-5 MINOR offering matches this minor path
    // (programme-scoped when programVersionId is set).
    if (s.programVersionId) {
      const offerings = await prisma.courseOffering.findMany({
        where: {
          tenantId,
          programVersionId: s.programVersionId,
          semesterSequence: 5,
          category: { equals: 'MINOR', mode: 'insensitive' },
          deletedAt: null,
        },
        include: { course: true },
        take: 40,
      });
      const matched = offerings.filter((o) =>
        courseMatchesSubjectPath(o.course, minorChoice.subjectSlug),
      );
      if (offerings.length > 0 && matched.length === 0) {
        stats.noSem5MinorOffering++;
        problems.push(
          `${label}: no Sem-5 MINOR offering matches ${minorChoice.subjectSlug}`,
        );
        continue;
      }
    }

    stats.ready++;
    if (readySamples.length < limit) {
      readySamples.push(
        `${label}: ${s.majorMinorTrack.majorSubject?.name} / ${s.majorMinorTrack.minorSubject?.name}`,
      );
    }
  }

  console.log(
    `\nLegacy minor promotion readiness — tenant=${tenant.slug} sem>=${semMin}`,
  );
  console.log(JSON.stringify(stats, null, 2));
  console.log('\nReady samples:');
  for (const line of readySamples) console.log(`  OK  ${line}`);
  if (problems.length) {
    console.log(`\nProblems (${problems.length}):`);
    for (const p of problems.slice(0, 40)) console.log(`  XX  ${p}`);
    if (problems.length > 40)
      console.log(`  … and ${problems.length - 40} more`);
  }

  if (
    stats.missingMinorChoice +
      stats.missingTrackMinor +
      stats.invalidPair +
      stats.noSem5MinorOffering >
    0
  ) {
    process.exitCode = 2;
  } else {
    console.log('\nAll scanned students are ready for Sem 4→5 Minor mapping.');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
