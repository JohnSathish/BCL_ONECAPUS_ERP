/**
 * Permanently delete specific students by registration number (hard delete).
 * Usage:
 *   node scripts/purge-students-by-reg.mjs REG001 REG002 ...
 *   node scripts/purge-students-by-reg.mjs --apply REG001 REG002
 *   node scripts/purge-students-by-reg.mjs --tenant=demo --apply REG001
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function readArg(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const tenantSlug = readArg('tenant') ?? process.env.TENANT_SLUG ?? 'demo';
  const enrollmentNumbers = process.argv
    .slice(2)
    .filter((a) => !a.startsWith('--'));

  if (enrollmentNumbers.length === 0) {
    console.error(
      'Usage: node scripts/purge-students-by-reg.mjs [--apply] [--tenant=slug] REG001 REG002 ...',
    );
    process.exit(1);
  }

  const tenant = await prisma.tenant.findFirst({ where: { slug: tenantSlug } });
  if (!tenant) {
    console.error(`Tenant "${tenantSlug}" not found.`);
    process.exit(1);
  }

  const students = await prisma.student.findMany({
    where: {
      tenantId: tenant.id,
      enrollmentNumber: {
        in: enrollmentNumbers,
        mode: 'insensitive',
      },
    },
    select: {
      id: true,
      userId: true,
      enrollmentNumber: true,
      rollNumber: true,
      deletedAt: true,
      masterProfile: {
        select: { fullName: true, email: true, mobileNumber: true },
      },
      abcAccount: { select: { abcId: true } },
    },
    orderBy: { enrollmentNumber: 'asc' },
  });

  console.log(`Tenant: ${tenant.slug}`);
  console.log(`Requested: ${enrollmentNumbers.join(', ')}`);
  console.log(`Matched: ${students.length}`);

  for (const s of students) {
    console.log(
      `  - ${s.masterProfile?.fullName ?? '(no name)'} | reg=${s.enrollmentNumber} | roll=${s.rollNumber ?? '—'} | email=${s.masterProfile?.email ?? '—'} | mobile=${s.masterProfile?.mobileNumber ?? '—'} | abc=${s.abcAccount?.abcId ?? '—'}${s.deletedAt ? ' [soft-deleted]' : ''}`,
    );
  }

  const missing = enrollmentNumbers.filter(
    (reg) =>
      !students.some(
        (s) => s.enrollmentNumber.toUpperCase() === reg.toUpperCase(),
      ),
  );
  if (missing.length) {
    console.log(`Not found: ${missing.join(', ')}`);
  }

  if (!apply) {
    console.log('\nDry run only. Re-run with --apply to permanently delete.');
    return;
  }

  if (students.length === 0) {
    console.log('Nothing to delete.');
    return;
  }

  const studentIds = students.map((s) => s.id);
  const userIds = [...new Set(students.map((s) => s.userId))];
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.student.deleteMany({ where: { id: { in: studentIds } } });

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
  });

  console.log(
    `\nDeleted ${students.length} student(s). Deactivated ${userIds.length} portal user(s).`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
