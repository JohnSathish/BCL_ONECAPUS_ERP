/**
 * Remove seeded demo staff/students from a production tenant (soft-delete).
 *
 * Targets records created by prisma/seed.ts:
 *   - Users with @demo.edu email
 *   - Students with enrollment numbers starting with DEMO-
 *   - Staff profiles linked to @demo.edu portal users or staff email
 *
 * College setup (programs, fees, branding, roles) is NOT removed.
 *
 * Usage:
 *   npx tsx scripts/production-purge-demo.ts
 *   npx tsx scripts/production-purge-demo.ts --confirm
 *   npx tsx scripts/production-purge-demo.ts --confirm --keep-email admin@demo.edu
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_TENANT_SLUG = 'demo';
const DEMO_EMAIL_SUFFIX = '@demo.edu';
const DEMO_ENROLLMENT_PREFIX = 'DEMO-';

type Options = {
  tenantSlug: string;
  confirm: boolean;
  keepEmails: Set<string>;
};

function parseArgs(argv: string[]): Options {
  const opts: Options = {
    tenantSlug: DEFAULT_TENANT_SLUG,
    confirm: false,
    keepEmails: new Set<string>(),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--confirm') {
      opts.confirm = true;
    } else if (arg === '--tenant-slug' && argv[i + 1]) {
      opts.tenantSlug = argv[i + 1]!.trim().toLowerCase();
      i += 1;
    } else if (arg === '--keep-email' && argv[i + 1]) {
      opts.keepEmails.add(argv[i + 1]!.trim().toLowerCase());
      i += 1;
    }
  }

  return opts;
}

function isDemoEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return normalized.endsWith(DEMO_EMAIL_SUFFIX);
}

function isProtectedEmail(email: string, keepEmails: Set<string>): boolean {
  const normalized = email.trim().toLowerCase();
  if (keepEmails.has(normalized)) return true;
  if (normalized.endsWith('@donboscocollege.ac.in')) return true;
  return false;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  const tenant = await prisma.tenant.findFirst({
    where: { slug: opts.tenantSlug, deletedAt: null },
  });
  if (!tenant) {
    throw new Error(`Tenant "${opts.tenantSlug}" not found.`);
  }

  console.log(`\nDemo purge — tenant: ${tenant.name} (${tenant.slug})`);
  console.log(
    opts.confirm
      ? 'Mode: APPLY (soft-delete)\n'
      : 'Mode: DRY RUN (preview only)\n',
  );

  const demoUsers = await prisma.user.findMany({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      email: { endsWith: DEMO_EMAIL_SUFFIX, mode: 'insensitive' },
    },
    select: { id: true, email: true, displayName: true },
  });
  const usersToPurge = demoUsers.filter(
    (u) => !isProtectedEmail(u.email, opts.keepEmails),
  );

  const demoStudents = await prisma.student.findMany({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      OR: [
        {
          enrollmentNumber: {
            startsWith: DEMO_ENROLLMENT_PREFIX,
            mode: 'insensitive',
          },
        },
        {
          user: {
            email: { endsWith: DEMO_EMAIL_SUFFIX, mode: 'insensitive' },
            deletedAt: null,
          },
        },
      ],
    },
    select: {
      id: true,
      enrollmentNumber: true,
      user: { select: { email: true } },
    },
  });
  const studentsToPurge = demoStudents.filter(
    (s) => !s.user?.email || !isProtectedEmail(s.user.email, opts.keepEmails),
  );

  const demoStaff = await prisma.staffProfile.findMany({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      OR: [
        { email: { endsWith: DEMO_EMAIL_SUFFIX, mode: 'insensitive' } },
        {
          portalUser: {
            email: { endsWith: DEMO_EMAIL_SUFFIX, mode: 'insensitive' },
            deletedAt: null,
          },
        },
      ],
    },
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      email: true,
      portalUser: { select: { id: true, email: true } },
    },
  });
  const staffToPurge = demoStaff.filter((s) => {
    const portalEmail = s.portalUser?.email;
    if (portalEmail && isProtectedEmail(portalEmail, opts.keepEmails))
      return false;
    if (s.email && isProtectedEmail(s.email, opts.keepEmails)) return false;
    return true;
  });

  const skippedUsers = demoUsers.length - usersToPurge.length;
  const userIds = usersToPurge.map((u) => u.id);
  const studentIds = studentsToPurge.map((s) => s.id);
  const staffIds = staffToPurge.map((s) => s.id);

  console.log('Users (@demo.edu):');
  if (usersToPurge.length === 0) console.log('  (none)');
  for (const u of usersToPurge) {
    console.log(`  - ${u.email}${u.displayName ? ` (${u.displayName})` : ''}`);
  }
  if (skippedUsers > 0) {
    console.log(`  (${skippedUsers} protected / kept)`);
  }

  console.log('\nStudents (DEMO-* or linked @demo.edu):');
  if (studentsToPurge.length === 0) console.log('  (none)');
  for (const s of studentsToPurge) {
    console.log(
      `  - ${s.enrollmentNumber}${s.user?.email ? ` · ${s.user.email}` : ''}`,
    );
  }

  console.log('\nStaff (@demo.edu):');
  if (staffToPurge.length === 0) console.log('  (none)');
  for (const s of staffToPurge) {
    const email = s.portalUser?.email ?? s.email ?? '—';
    console.log(`  - ${s.fullName} · ${s.employeeCode} · ${email}`);
  }

  const total =
    usersToPurge.length + studentsToPurge.length + staffToPurge.length;
  console.log(`\nTotal records to soft-delete: ${total}`);

  if (!opts.confirm) {
    console.log('\nDry run only. Re-run with --confirm to apply.');
    console.log('Backup first:');
    console.log(
      '  docker compose exec -T postgres pg_dump -U nep nep_erp > backup_before_demo_purge.sql\n',
    );
    return;
  }

  if (total === 0) {
    console.log('\nNothing to purge.\n');
    return;
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    if (studentIds.length > 0) {
      await tx.student.updateMany({
        where: { id: { in: studentIds }, tenantId: tenant.id },
        data: { deletedAt: now },
      });
    }

    if (staffIds.length > 0) {
      await tx.staffProfile.updateMany({
        where: { id: { in: staffIds }, tenantId: tenant.id },
        data: { deletedAt: now, status: 'INACTIVE' },
      });
    }

    if (userIds.length > 0) {
      await tx.userRole.updateMany({
        where: { userId: { in: userIds }, deletedAt: null },
        data: { deletedAt: now },
      });

      await tx.refreshSession.updateMany({
        where: { userId: { in: userIds }, revokedAt: null },
        data: { revokedAt: now },
      });

      await tx.user.updateMany({
        where: { id: { in: userIds }, tenantId: tenant.id },
        data: {
          deletedAt: now,
          isActive: false,
          accountStatus: 'inactive',
        },
      });
    }
  });

  console.log('\nDone. Soft-deleted:');
  console.log(`  users:    ${usersToPurge.length}`);
  console.log(`  students: ${studentsToPurge.length}`);
  console.log(`  staff:    ${staffToPurge.length}`);
  console.log('\nRefresh the Staff / Student directories in the admin UI.\n');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
