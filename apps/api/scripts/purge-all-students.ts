/**
 * Permanently delete all student records (including soft-deleted) and reset roll number sequences.
 * Student portal users are deactivated and emails anonymized (hard user delete is blocked by
 * immutable audit_logs).
 *
 *   npx tsx scripts/purge-all-students.ts
 *   npx tsx scripts/purge-all-students.ts --apply
 *   TENANT_SLUG=demo npx tsx scripts/purge-all-students.ts --apply
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

async function resetSeatLedgers(tenantId: string) {
  const sections = await prisma.offeringSection.findMany({
    where: { tenantId, deletedAt: null },
    select: { id: true },
  });

  let updated = 0;
  for (const section of sections) {
    const confirmed = await prisma.semesterRegistrationLine.count({
      where: { offeringSectionId: section.id, status: 'confirmed' },
    });
    const waitlisted = await prisma.semesterRegistrationLine.count({
      where: { offeringSectionId: section.id, status: 'waitlisted' },
    });
    await prisma.offeringSeatLedger.upsert({
      where: { offeringSectionId: section.id },
      create: {
        offeringSectionId: section.id,
        tenantId,
        confirmedCount: confirmed,
        waitlistCount: waitlisted,
      },
      update: {
        confirmedCount: confirmed,
        waitlistCount: waitlisted,
      },
    });
    updated += 1;
  }
  return updated;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const tenantSlug = readArg('tenant') ?? process.env.TENANT_SLUG ?? 'demo';

  const tenant = await prisma.tenant.findFirst({ where: { slug: tenantSlug } });
  if (!tenant) {
    console.error(`Tenant "${tenantSlug}" not found.`);
    process.exit(1);
  }

  const students = await prisma.student.findMany({
    where: { tenantId: tenant.id },
    select: {
      id: true,
      userId: true,
      enrollmentNumber: true,
      rollNumber: true,
      deletedAt: true,
      masterProfile: { select: { fullName: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const rollSequences = await prisma.rollNumberSequence.findMany({
    where: { tenantId: tenant.id },
    select: { id: true, prefix: true, admissionYear: true, nextSequence: true },
  });

  console.log(`Tenant: ${tenant.slug} (${tenant.id})`);
  console.log(`Students to purge: ${students.length}`);
  for (const s of students) {
    console.log(
      `  - ${s.masterProfile?.fullName ?? '(no name)'} | reg=${s.enrollmentNumber} | roll=${s.rollNumber ?? '—'}${s.deletedAt ? ' [soft-deleted]' : ''}`,
    );
  }
  console.log(`Roll number sequences to reset: ${rollSequences.length}`);
  for (const seq of rollSequences) {
    console.log(
      `  - ${seq.prefix}${seq.admissionYear}: next=${seq.nextSequence} → 1`,
    );
  }

  if (!apply) {
    console.log('\nDry run only. Re-run with --apply to permanently delete.');
    return;
  }

  if (students.length === 0 && rollSequences.length === 0) {
    console.log('Nothing to purge.');
    return;
  }

  const userIds = [...new Set(students.map((s) => s.userId))];
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.studentRollNumberAuditLog.deleteMany({
      where: { tenantId: tenant.id },
    });

    if (students.length > 0) {
      await tx.student.deleteMany({ where: { tenantId: tenant.id } });

      if (userIds.length > 0) {
        await tx.refreshSession.updateMany({
          where: { userId: { in: userIds }, revokedAt: null },
          data: { revokedAt: now },
        });
        await tx.userRole.updateMany({
          where: { userId: { in: userIds }, deletedAt: null },
          data: { deletedAt: now },
        });
        for (const userId of userIds) {
          await tx.user.update({
            where: { id: userId },
            data: {
              email: `purged.${userId.replace(/-/g, '').slice(0, 12)}@purged.local`,
              deletedAt: now,
              isActive: false,
              accountStatus: 'inactive',
            },
          });
        }
      }
    }

    await tx.rollNumberSequence.updateMany({
      where: { tenantId: tenant.id },
      data: { nextSequence: 1 },
    });
  });

  const ledgersReset = await resetSeatLedgers(tenant.id);

  const remaining = await prisma.student.count({
    where: { tenantId: tenant.id },
  });
  const sequences = await prisma.rollNumberSequence.findMany({
    where: { tenantId: tenant.id },
    select: { prefix: true, admissionYear: true, nextSequence: true },
  });
  const staleLedgers = await prisma.offeringSeatLedger.count({
    where: { tenantId: tenant.id, confirmedCount: { gt: 0 } },
  });

  console.log('\nPurge complete.');
  console.log(`Remaining students: ${remaining}`);
  console.log(`Portal users deactivated: ${userIds.length}`);
  console.log(`Seat ledgers recalculated: ${ledgersReset}`);
  console.log(`Sections with enrolled count > 0: ${staleLedgers}`);
  console.log(
    'Roll sequences:',
    sequences
      .map((s) => `${s.prefix}${s.admissionYear}=${s.nextSequence}`)
      .join(', ') || 'none',
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
