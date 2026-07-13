/**
 * Reset all active student portal passwords to their college roll number
 * (fallback: enrollment number), and force change on next login.
 *
 * Usage (API container):
 *   npx --yes tsx scripts/reset-student-passwords-to-roll.ts
 *   npx --yes tsx scripts/reset-student-passwords-to-roll.ts --tenant=demo
 *   npx --yes tsx scripts/reset-student-passwords-to-roll.ts --dry-run
 *   npx --yes tsx scripts/reset-student-passwords-to-roll.ts --only-must-reset
 */
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { resolveStudentDefaultPassword } from '../src/modules/students/student-credentials.util';

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const dryRun = hasFlag('dry-run');
  const onlyMustReset = hasFlag('only-must-reset');
  const tenantSlug = arg('tenant') ?? 'demo';

  const tenant = await prisma.tenant.findFirst({
    where: { slug: tenantSlug, deletedAt: null },
    select: { id: true, slug: true, name: true },
  });
  if (!tenant) {
    throw new Error(`Tenant not found: ${tenantSlug}`);
  }

  const students = await prisma.student.findMany({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      user: {
        deletedAt: null,
        isActive: true,
        ...(onlyMustReset ? { mustResetPassword: true } : {}),
      },
    },
    select: {
      id: true,
      rollNumber: true,
      enrollmentNumber: true,
      userId: true,
      user: {
        select: {
          email: true,
          mustResetPassword: true,
          username: true,
        },
      },
    },
    orderBy: { rollNumber: 'asc' },
  });

  console.log(
    JSON.stringify(
      {
        tenant: tenant.slug,
        dryRun,
        onlyMustReset,
        candidates: students.length,
      },
      null,
      2,
    ),
  );

  let updated = 0;
  let skipped = 0;

  for (const student of students) {
    const plain = resolveStudentDefaultPassword({
      rollNumber: student.rollNumber,
      enrollmentNumber: student.enrollmentNumber,
    });
    if (!student.rollNumber?.trim() && !student.enrollmentNumber?.trim()) {
      skipped += 1;
      console.log(`SKIP no roll/enrollment user=${student.user.email}`);
      continue;
    }

    const username =
      student.rollNumber?.trim() ||
      student.enrollmentNumber?.trim() ||
      student.user.username;

    if (dryRun) {
      console.log(
        `DRY ${student.rollNumber ?? student.enrollmentNumber} → password=roll, username=${username}`,
      );
      updated += 1;
      continue;
    }

    const passwordHash = await bcrypt.hash(plain, 12);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: student.userId },
        data: {
          passwordHash,
          username,
          mustResetPassword: true,
          passwordChangedAt: new Date(),
        },
      });
      await tx.refreshSession.updateMany({
        where: { userId: student.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
    updated += 1;
    if (updated % 50 === 0) {
      console.log(`… updated ${updated}/${students.length}`);
    }
  }

  console.log(JSON.stringify({ updated, skipped, dryRun }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
