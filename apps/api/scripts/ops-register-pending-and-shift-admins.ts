/**
 * Finalize ALL non-completed semester registrations so Programme & subjects
 * shows Registered (status=completed), plus assign Day/Morning Shift Admins.
 *
 * Default = dry-run. Apply with CONFIRM=YES or --apply.
 *
 *   cd apps/api
 *   npx tsx scripts/ops-register-pending-and-shift-admins.ts
 *   CONFIRM=YES npx tsx scripts/ops-register-pending-and-shift-admins.ts
 *
 * Options:
 *   --tenant=demo
 *   --skip-registrations
 *   --skip-shift-admins
 *   --batch=100
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

const apply = process.env.CONFIRM === 'YES' || process.argv.includes('--apply');
const tenantSlug = readArg('tenant') ?? process.env.TENANT_SLUG ?? 'demo';
const skipRegs = process.argv.includes('--skip-registrations');
const skipAdmins = process.argv.includes('--skip-shift-admins');
const batchSize = Math.max(1, Number(readArg('batch') ?? '100'));

/** employeeCode → shift code */
const SHIFT_ADMINS: Array<{ employeeCode: string; shiftCode: string }> = [
  { employeeCode: 'DBCNTS-26-001', shiftCode: 'DAY' },
  { employeeCode: 'DBCNTS-26-011', shiftCode: 'DAY' },
  { employeeCode: 'DBCNTS-23-001', shiftCode: 'MORNING' },
];

async function ensureShiftAdminRole(tenantId: string, userId: string) {
  const role = await prisma.role.findFirst({
    where: { tenantId, slug: 'shift-admin', deletedAt: null },
  });
  if (!role) throw new Error('shift-admin role missing for tenant');
  const existing = await prisma.userRole.findFirst({
    where: { userId, roleId: role.id, deletedAt: null },
  });
  if (!existing) {
    await prisma.userRole.create({ data: { userId, roleId: role.id } });
  }
}

async function finalizePendingRegistrations(tenantId: string) {
  const regs = await prisma.semesterRegistration.findMany({
    where: {
      tenantId,
      status: { notIn: ['completed', 'rejected'] },
      student: { deletedAt: null },
    },
    select: {
      id: true,
      status: true,
      semesterSequence: true,
      student: { select: { enrollmentNumber: true, rollNumber: true } },
      lines: {
        select: { id: true, offeringSectionId: true, status: true },
      },
    },
  });

  const ready: typeof regs = [];
  const skippedNoLines: string[] = [];
  const skippedNullSection: string[] = [];

  for (const reg of regs) {
    const label =
      reg.student.rollNumber ?? reg.student.enrollmentNumber ?? reg.id;
    if (reg.lines.length === 0) {
      skippedNoLines.push(label);
      continue;
    }
    if (reg.lines.some((l) => !l.offeringSectionId)) {
      skippedNullSection.push(label);
      continue;
    }
    ready.push(reg);
  }

  console.log(`\n=== Programme registration finalize ===`);
  console.log(`Pending/non-complete regs found: ${regs.length}`);
  console.log(`Ready to mark Registered: ${ready.length}`);
  if (skippedNoLines.length) {
    console.log(`Skipped (no subject lines): ${skippedNoLines.length}`);
  }
  if (skippedNullSection.length) {
    console.log(
      `Skipped (missing offering section): ${skippedNullSection.length}`,
    );
    console.log(`  sample: ${skippedNullSection.slice(0, 8).join(', ')}`);
  }

  const bySem = new Map<number, number>();
  for (const r of ready) {
    bySem.set(r.semesterSequence, (bySem.get(r.semesterSequence) ?? 0) + 1);
  }
  console.log('By semester sequence:');
  for (const [sem, n] of [...bySem.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  Sem ${sem}: ${n}`);
  }

  if (!apply) {
    console.log('DRY-RUN — no registration writes.');
    return { finalized: 0, lines: 0 };
  }

  let totalRegs = 0;
  let totalLines = 0;
  const ids = ready.map((r) => r.id);
  for (let i = 0; i < ids.length; i += batchSize) {
    const chunk = ids.slice(i, i + batchSize);
    const result = await prisma.$transaction(
      async (tx) => {
        const lines = await tx.semesterRegistrationLine.updateMany({
          where: { registrationId: { in: chunk }, status: 'pending' },
          data: { status: 'confirmed' },
        });
        const updated = await tx.semesterRegistration.updateMany({
          where: {
            id: { in: chunk },
            status: { notIn: ['completed', 'rejected'] },
          },
          data: { status: 'completed', submittedAt: new Date() },
        });
        return { lines: lines.count, regs: updated.count };
      },
      { timeout: 60_000, maxWait: 10_000 },
    );
    totalRegs += result.regs;
    totalLines += result.lines;
    console.log(
      `  batch ${Math.floor(i / batchSize) + 1}: ${result.regs} regs, ${result.lines} lines`,
    );
  }
  console.log(
    `Finalized ${totalRegs} → Registered; confirmed ${totalLines} lines.`,
  );
  return { finalized: totalRegs, lines: totalLines };
}

async function assignShiftAdmins(tenantId: string) {
  console.log(`\n=== Shift Admin assignments ===`);
  const shifts = await prisma.shift.findMany({
    where: { tenantId, deletedAt: null },
    select: { id: true, code: true, name: true },
  });
  const byCode = new Map(shifts.map((s) => [s.code.toUpperCase(), s]));

  for (const row of SHIFT_ADMINS) {
    const shift = byCode.get(row.shiftCode.toUpperCase());
    if (!shift) {
      console.log(`FAIL ${row.employeeCode}: shift ${row.shiftCode} not found`);
      continue;
    }
    const staff = await prisma.staffProfile.findFirst({
      where: {
        tenantId,
        employeeCode: row.employeeCode,
        deletedAt: null,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        portalUserId: true,
        portalUser: { select: { id: true, email: true } },
      },
    });
    if (!staff) {
      console.log(`FAIL ${row.employeeCode}: staff profile not found`);
      continue;
    }
    const userId = staff.portalUserId ?? staff.portalUser?.id ?? null;
    if (!userId) {
      console.log(
        `FAIL ${row.employeeCode} (${staff.fullName}): no portal user — create Portal user first`,
      );
      continue;
    }

    if (!apply) {
      console.log(
        `DRY-RUN would assign ${row.employeeCode} (${staff.fullName}) → ${shift.name} (${shift.code}) as shift-admin`,
      );
      continue;
    }

    await ensureShiftAdminRole(tenantId, userId);
    await prisma.userShiftAssignment.updateMany({
      where: { userId },
      data: { isPrimary: false },
    });
    const existing = await prisma.userShiftAssignment.findFirst({
      where: { userId, shiftId: shift.id },
    });
    if (existing) {
      await prisma.userShiftAssignment.update({
        where: { id: existing.id },
        data: { isPrimary: true },
      });
      console.log(
        `OK ${row.employeeCode}: already on ${shift.code}, set primary + shift-admin`,
      );
    } else {
      await prisma.userShiftAssignment.create({
        data: { userId, shiftId: shift.id, isPrimary: true },
      });
      console.log(
        `OK ${row.employeeCode} (${staff.fullName}) → ${shift.code} shift-admin`,
      );
    }
  }
}

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: tenantSlug.toLowerCase(), deletedAt: null },
  });
  if (!tenant) throw new Error(`Tenant not found: ${tenantSlug}`);

  console.log(
    `Ops register + shift admins — tenant=${tenant.slug} mode=${apply ? 'APPLY' : 'DRY-RUN'}`,
  );

  if (!skipRegs) await finalizePendingRegistrations(tenant.id);
  if (!skipAdmins) await assignShiftAdmins(tenant.id);

  if (!apply) {
    console.log(
      `\nDry-run complete. Re-run with CONFIRM=YES (or --apply) to write.\n`,
    );
  } else {
    console.log(`\nDone.\n`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
