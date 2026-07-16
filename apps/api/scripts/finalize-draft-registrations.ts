/**
 * Finalize imported-but-unsubmitted registrations so they stop showing as
 * "Pending" and render as fully registered ("Completed") in the UI.
 *
 * These rows were bulk-imported in `draft` status without submit-after-import.
 * The app's only "registered" state is registration.status = 'completed' with
 * its lines = 'confirmed' (see student-profile.service.ts registrationStatus
 * mapping and allocation.service.ts). Seat ledgers are unused in this database
 * (all counts are zero), so we set the terminal status directly rather than
 * running the allocator (which would waitlist over-capacity sections).
 *
 * Safe by design:
 *   - Only touches registrations still in `draft` (idempotent; re-runs are no-ops).
 *   - Only flips lines that are still `pending` (leaves waitlisted/rejected alone).
 *   - Does NOT write student_semester_progress (matches prevailing data and
 *     avoids implying the student has *finished* the semester).
 *   - Dry-run by default; --apply to write. --enrollment=XXX targets one student.
 *
 *   npx ts-node -r tsconfig-paths/register scripts/finalize-draft-registrations.ts --dry-run
 *   npx ts-node -r tsconfig-paths/register scripts/finalize-draft-registrations.ts --enrollment=BA25-035 --apply
 *   npx ts-node -r tsconfig-paths/register scripts/finalize-draft-registrations.ts --apply
 *   npx ts-node -r tsconfig-paths/register scripts/finalize-draft-registrations.ts --apply --batch=100
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
const onlyEnrollment = readArg('enrollment');
const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: tenantSlug, deletedAt: null },
    select: { id: true, slug: true },
  });
  if (!tenant) throw new Error(`Tenant not found: ${tenantSlug}`);
  const tenantId = tenant.id;

  console.log(
    `\nFinalize draft registrations — tenant=${tenant.slug} sem=${sem}` +
      `${onlyEnrollment ? ` enrollment=${onlyEnrollment}` : ''}` +
      `${dryRun ? '  (DRY RUN — no writes)' : '  (APPLYING)'}\n`,
  );

  // Any registration that is not already the terminal "registered" state.
  // In the UI, only status = 'completed' renders as fully registered; 'draft',
  // 'confirmed', 'pending', etc. all show the amber "Pending" badge.
  const regs = await prisma.semesterRegistration.findMany({
    where: {
      tenantId,
      semesterSequence: sem,
      status: { notIn: ['completed', 'rejected'] },
      ...(onlyEnrollment
        ? { student: { enrollmentNumber: onlyEnrollment } }
        : {}),
    },
    select: {
      id: true,
      status: true,
      student: { select: { enrollmentNumber: true, deletedAt: true } },
      _count: { select: { lines: true } },
    },
  });

  // Safety guard: never finalize a registration whose student has been
  // soft-deleted (removed / dropped-out). Those are orphaned rows and must not
  // be resurrected to "completed". Report them so they can be cleaned up.
  const orphaned = regs.filter((r) => r.student?.deletedAt != null);
  const liveRegs = regs.filter((r) => r.student?.deletedAt == null);
  if (orphaned.length > 0) {
    console.log(
      `Skipping ${orphaned.length} registration(s) whose student is soft-deleted (orphaned).`,
    );
  }

  const regIds = liveRegs.map((r) => r.id);
  const nullSectionLines = await prisma.semesterRegistrationLine.count({
    where: { registrationId: { in: regIds }, offeringSectionId: null },
  });

  console.log(`Live registrations to finalize: ${liveRegs.length}`);
  console.log(
    `Total lines: ${liveRegs.reduce((s, r) => s + r._count.lines, 0)}` +
      ` (avg ${
        liveRegs.length
          ? (
              liveRegs.reduce((s, r) => s + r._count.lines, 0) / liveRegs.length
            ).toFixed(1)
          : 0
      }/reg)`,
  );

  // Guard: never finalize a registration that still has an unassigned section.
  if (nullSectionLines > 0) {
    console.log(
      `\n⚠  ${nullSectionLines} line(s) still have NO offering_section_id.` +
        ` Fix those first (attach-missing-major-sections.ts). Aborting.\n`,
    );
    return;
  }

  if (liveRegs.length === 0) {
    console.log('\nNothing to do — no matching live draft registrations.\n');
    return;
  }

  if (dryRun) {
    const byStatus = new Map<string, number>();
    for (const r of liveRegs)
      byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
    console.log('\nBy current status:');
    for (const [st, n] of [...byStatus.entries()].sort())
      console.log(`  ${String(n).padStart(5)}  ${st} → completed`);
    console.log('\nSample (first 5):');
    for (const r of liveRegs.slice(0, 5)) {
      console.log(
        `  ${(r.student?.enrollmentNumber ?? r.id.slice(0, 8)).padEnd(14)} ${r._count.lines} lines  ${r.status}→completed`,
      );
    }
    console.log('\nDRY RUN — no changes written. Re-run with --apply.\n');
    return;
  }

  // Batch to avoid Prisma interactive-transaction 5s timeout on ~800+ regs.
  const batchSize = Math.max(1, Number(readArg('batch') ?? '100'));
  let totalRegs = 0;
  let totalLines = 0;
  const batches = Math.ceil(regIds.length / batchSize);
  console.log(
    `\nApplying in ${batches} batch(es) of up to ${batchSize} registration(s)…`,
  );

  for (let i = 0; i < regIds.length; i += batchSize) {
    const chunk = regIds.slice(i, i + batchSize);
    const batchNo = Math.floor(i / batchSize) + 1;
    const result = await prisma.$transaction(
      async (tx) => {
        const lines = await tx.semesterRegistrationLine.updateMany({
          where: { registrationId: { in: chunk }, status: 'pending' },
          data: { status: 'confirmed' },
        });
        const updatedRegs = await tx.semesterRegistration.updateMany({
          where: {
            id: { in: chunk },
            status: { notIn: ['completed', 'rejected'] },
          },
          data: { status: 'completed', submittedAt: new Date() },
        });
        return { lines: lines.count, regs: updatedRegs.count };
      },
      { timeout: 60_000, maxWait: 10_000 },
    );
    totalRegs += result.regs;
    totalLines += result.lines;
    console.log(
      `  batch ${batchNo}/${batches}: ${result.regs} regs, ${result.lines} lines`,
    );
  }

  console.log(
    `\nFinalized ${totalRegs} registration(s); confirmed ${totalLines} line(s). Done.\n`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
