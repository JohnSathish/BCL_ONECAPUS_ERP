/**
 * Backfill student_vtc_tracks from each student's confirmed Semester-3 VTC
 * selection. Without this, promotion into Sem 4/6 finds no valid VTC (the
 * track group is unknown) and fails.
 *
 * Run AFTER fix-sem4-vtc-stage2.ts (which tags courses with the track group).
 * Idempotent. Safe to re-run.
 *
 * Usage (from apps/api):
 *   npx ts-node -r tsconfig-paths/register scripts/backfill-vtc-tracks.ts --dry-run
 *   npx ts-node -r tsconfig-paths/register scripts/backfill-vtc-tracks.ts
 *   npx ts-node -r tsconfig-paths/register scripts/backfill-vtc-tracks.ts --tenant=demo
 */
import { PrismaClient } from '@prisma/client';
import { resolveVtcTrackFields } from '../src/common/services/vtc-track-metadata';

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

const dryRun = process.argv.includes('--dry-run');
const tenantSlug = readArg('tenant') ?? 'demo';
const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: tenantSlug, deletedAt: null },
    select: { id: true, slug: true },
  });
  if (!tenant) throw new Error(`Tenant not found: ${tenantSlug}`);
  const tenantId = tenant.id;

  console.log(
    `\nBackfill VTC tracks — tenant=${tenant.slug}${dryRun ? '  (DRY RUN)' : ''}\n`,
  );

  // Real students hold their (single) Sem-3 VTC choice as a pending line in a
  // draft registration; only demo accounts are "confirmed" (in every vocation).
  const lines = await prisma.semesterRegistrationLine.findMany({
    where: {
      tenantId,
      category: { equals: 'VTC', mode: 'insensitive' },
      status: { in: ['confirmed', 'pending'] },
      registration: { semesterSequence: 3 },
    },
    select: {
      offeringId: true,
      status: true,
      registration: { select: { studentId: true } },
      offering: {
        select: {
          course: {
            select: {
              code: true,
              title: true,
              vtcTrackGroupCode: true,
              vtcTrackStage: true,
            },
          },
        },
      },
    },
  });

  // Collapse to one choice per student; prefer confirmed over pending.
  type Choice = { group: string; offeringId: string; confirmed: boolean };
  const byStudent = new Map<string, Map<string, Choice>>();
  for (const line of lines) {
    const course = line.offering?.course;
    if (!course) continue;
    const meta = resolveVtcTrackFields({
      code: course.code,
      title: course.title,
      vtcTrackGroupCode: course.vtcTrackGroupCode,
      vtcTrackStage: course.vtcTrackStage,
    });
    if (!meta.vtcTrackGroupCode) continue;
    const studentId = line.registration.studentId;
    const groups = byStudent.get(studentId) ?? new Map<string, Choice>();
    const confirmed = line.status === 'confirmed';
    const prev = groups.get(meta.vtcTrackGroupCode);
    if (!prev || (confirmed && !prev.confirmed)) {
      groups.set(meta.vtcTrackGroupCode, {
        group: meta.vtcTrackGroupCode,
        offeringId: line.offeringId,
        confirmed,
      });
    }
    byStudent.set(studentId, groups);
  }

  const stats = {
    sem3VtcLines: lines.length,
    studentsSeen: byStudent.size,
    created: 0,
    updated: 0,
    alreadyOk: 0,
    skippedAmbiguous: 0,
    byGroup: {} as Record<string, number>,
  };

  for (const [studentId, groups] of byStudent) {
    if (groups.size !== 1) {
      // Demo accounts are enrolled in every vocation — ignore them.
      stats.skippedAmbiguous++;
      continue;
    }
    const choice = [...groups.values()][0]!;
    stats.byGroup[choice.group] = (stats.byGroup[choice.group] ?? 0) + 1;

    const existing = await prisma.studentVtcTrack.findUnique({
      where: { studentId },
      select: { id: true, trackGroupCode: true, selectedSem3OfferingId: true },
    });
    if (
      existing &&
      existing.trackGroupCode === choice.group &&
      existing.selectedSem3OfferingId === choice.offeringId
    ) {
      stats.alreadyOk++;
      continue;
    }
    if (dryRun) {
      existing ? stats.updated++ : stats.created++;
      continue;
    }
    await prisma.studentVtcTrack.upsert({
      where: { studentId },
      create: {
        tenantId,
        studentId,
        trackGroupCode: choice.group,
        selectedSem3OfferingId: choice.offeringId,
        lockedAtSemester: 3,
      },
      update: {
        trackGroupCode: choice.group,
        selectedSem3OfferingId: choice.offeringId,
      },
    });
    existing ? stats.updated++ : stats.created++;
  }

  console.log('Summary');
  console.log(JSON.stringify(stats, null, 2));
  const total = await prisma.studentVtcTrack.count({ where: { tenantId } });
  console.log(`\nstudent_vtc_tracks rows now: ${total}`);
  if (dryRun) console.log('\nDry run — no rows written.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
