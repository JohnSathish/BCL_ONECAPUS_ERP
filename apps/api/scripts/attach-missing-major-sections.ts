/**
 * Attach the correct offering section to Sem-3 draft registration lines that
 * were created without one (e.g. the 42 Garo-major students whose GAR-200 /
 * GAR-201 MAJOR lines have offering_section_id = NULL).
 *
 * For each null-section line it finds the single ACTIVE, non-deleted section in
 * the SAME course offering whose shift matches the registration's shift, and
 * attaches it. Lines with 0 or >1 candidate sections are left untouched and
 * reported so a human can decide. Idempotent; dry-run by default.
 *
 *   npx ts-node -r tsconfig-paths/register scripts/attach-missing-major-sections.ts --dry-run
 *   npx ts-node -r tsconfig-paths/register scripts/attach-missing-major-sections.ts --apply
 */
import { PrismaClient } from '@prisma/client';

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

const apply = process.argv.includes('--apply');
const dryRun = !apply;
const tenantSlug = readArg('tenant') ?? 'demo';
const sem = Number(readArg('sem') ?? '3');
const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: tenantSlug, deletedAt: null },
    select: { id: true, slug: true },
  });
  if (!tenant) throw new Error(`Tenant not found: ${tenantSlug}`);
  const tenantId = tenant.id;

  console.log(
    `\nAttach missing MAJOR sections — tenant=${tenant.slug} sem=${sem}${
      dryRun ? '  (DRY RUN — no writes)' : '  (APPLYING)'
    }\n`,
  );

  const lines = await prisma.semesterRegistrationLine.findMany({
    where: {
      tenantId,
      offeringSectionId: null,
      registration: { semesterSequence: sem, status: 'draft' },
    },
    select: {
      id: true,
      offeringId: true,
      category: true,
      registration: {
        select: {
          shiftId: true,
          student: { select: { enrollmentNumber: true } },
        },
      },
      offering: { select: { course: { select: { code: true } } } },
    },
  });

  console.log(`Null-section draft lines found: ${lines.length}\n`);

  // Cache candidate sections per (offeringId + shiftId) so we hit the DB once.
  const cache = new Map<string, { id: string; sectionCode: string }[]>();
  const candidateSections = async (offeringId: string, shiftId: string) => {
    const key = `${offeringId}:${shiftId}`;
    if (!cache.has(key)) {
      const secs = await prisma.offeringSection.findMany({
        where: {
          tenantId,
          courseOfferingId: offeringId,
          shiftId,
          status: 'active',
          deletedAt: null,
        },
        select: { id: true, sectionCode: true },
      });
      cache.set(key, secs);
    }
    return cache.get(key)!;
  };

  const toAttach: { lineId: string; sectionId: string; label: string }[] = [];
  const skipped: { label: string; reason: string }[] = [];

  for (const line of lines) {
    const enrollment = line.registration.student?.enrollmentNumber ?? '?';
    const course = line.offering.course?.code ?? '?';
    const label = `${enrollment} ${line.category}/${course}`;
    const shiftId = line.registration.shiftId;
    if (!shiftId) {
      skipped.push({ label, reason: 'registration has no shift' });
      continue;
    }
    const cands = await candidateSections(line.offeringId, shiftId);
    if (cands.length === 0) {
      skipped.push({ label, reason: 'no matching active section in shift' });
      continue;
    }
    if (cands.length > 1) {
      skipped.push({
        label,
        reason: `ambiguous — ${cands.length} sections match shift`,
      });
      continue;
    }
    toAttach.push({ lineId: line.id, sectionId: cands[0].id, label });
  }

  // Group the planned attaches by course for a readable summary.
  const byCourse = new Map<string, number>();
  for (const a of toAttach) {
    const course = a.label.split('/')[1] ?? a.label;
    byCourse.set(course, (byCourse.get(course) ?? 0) + 1);
  }

  console.log('Planned attaches (by course):');
  for (const [course, n] of [...byCourse.entries()].sort()) {
    console.log(`  ${String(n).padStart(4)}  ${course}`);
  }
  console.log(`  ${'-'.repeat(20)}`);
  console.log(`  ${String(toAttach.length).padStart(4)}  total\n`);

  if (skipped.length) {
    console.log(`Skipped (${skipped.length}):`);
    for (const s of skipped.slice(0, 40)) {
      console.log(`  ${s.label.padEnd(24)} ${s.reason}`);
    }
    if (skipped.length > 40) console.log(`  …and ${skipped.length - 40} more`);
    console.log('');
  }

  if (dryRun) {
    console.log(
      'DRY RUN — no changes written. Re-run with --apply to attach.\n',
    );
    return;
  }

  let done = 0;
  for (const a of toAttach) {
    await prisma.semesterRegistrationLine.update({
      where: { id: a.lineId },
      data: { offeringSectionId: a.sectionId },
    });
    done++;
  }
  console.log(`Attached ${done} section(s). Done.\n`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
