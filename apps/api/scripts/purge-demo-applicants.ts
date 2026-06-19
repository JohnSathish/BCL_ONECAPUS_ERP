/**
 * Hard-remove demo / smoke admission applications and applicant portal users.
 *
 * Targets:
 *   - Emails ending with @example.com (seed + smoke tests)
 *   - Emails containing applicant.smoke
 *   - Application numbers prefixed BCA-2026- (seed data)
 *   - Names like "Smoke Test"
 *
 * Real applicants (@donboscocollege.ac.in or other domains) are never removed.
 *
 * Usage:
 *   npx tsx scripts/purge-demo-applicants.ts
 *   npx tsx scripts/purge-demo-applicants.ts --confirm
 *   npx tsx scripts/purge-demo-applicants.ts --confirm --tenant-slug demo
 *   npx tsx scripts/purge-demo-applicants.ts --confirm --admin-email admin@donboscocollege.ac.in
 *   npx tsx scripts/purge-demo-applicants.ts --confirm --application-numbers DBCT26-0001,DBCT26-0002
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Options = {
  tenantSlug?: string;
  adminEmail?: string;
  applicationNumbers: string[];
  confirm: boolean;
};

function parseArgs(argv: string[]): Options {
  const opts: Options = { confirm: false, applicationNumbers: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--confirm') opts.confirm = true;
    else if (arg === '--tenant-slug' && argv[i + 1]) {
      opts.tenantSlug = argv[i + 1]!.trim().toLowerCase();
      i += 1;
    } else if (arg === '--admin-email' && argv[i + 1]) {
      opts.adminEmail = argv[i + 1]!.trim().toLowerCase();
      i += 1;
    } else if (arg === '--application-numbers' && argv[i + 1]) {
      opts.applicationNumbers = argv[i + 1]!.split(',')
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean);
      i += 1;
    }
  }
  return opts;
}

function isProtectedApplicantEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return normalized.endsWith('@donboscocollege.ac.in');
}

function isDemoApplicant(record: {
  email: string;
  firstName: string;
  lastName: string;
  applicationNumber: string;
}): boolean {
  if (isProtectedApplicantEmail(record.email)) return false;

  const email = record.email.trim().toLowerCase();
  if (email.endsWith('@example.com')) return true;
  if (email.includes('applicant.smoke')) return true;

  if (record.applicationNumber.toUpperCase().startsWith('BCA-2026-'))
    return true;

  const first = record.firstName.trim().toLowerCase();
  const last = record.lastName.trim().toLowerCase();
  if (first.includes('smoke') && last.includes('test')) return true;

  return false;
}

async function resolveTenant(opts: Options) {
  if (opts.tenantSlug) {
    const tenant = await prisma.tenant.findFirst({
      where: { slug: opts.tenantSlug, deletedAt: null },
    });
    if (!tenant) throw new Error(`Tenant slug "${opts.tenantSlug}" not found.`);
    return tenant;
  }

  if (opts.adminEmail) {
    const user = await prisma.user.findFirst({
      where: { email: opts.adminEmail, deletedAt: null },
      select: { tenantId: true },
    });
    if (!user) throw new Error(`Admin user "${opts.adminEmail}" not found.`);
    const tenant = await prisma.tenant.findFirst({
      where: { id: user.tenantId, deletedAt: null },
    });
    if (!tenant) throw new Error('Tenant for admin user not found.');
    return tenant;
  }

  const tenant = await prisma.tenant.findFirst({
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });
  if (!tenant)
    throw new Error('No tenant found. Pass --tenant-slug or --admin-email.');
  return tenant;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const tenant = await resolveTenant(opts);

  console.log(
    `\nDemo applicant purge — tenant: ${tenant.name} (${tenant.slug})`,
  );
  console.log(
    opts.confirm
      ? 'Mode: APPLY (hard-delete applications + deactivate demo applicant users)\n'
      : 'Mode: DRY RUN (preview only)\n',
  );

  const allApplications = await prisma.admissionApplication.findMany({
    where: { tenantId: tenant.id },
    select: {
      id: true,
      applicationNumber: true,
      firstName: true,
      lastName: true,
      email: true,
      status: true,
      applicantUserId: true,
      deletedAt: true,
    },
    orderBy: { applicationNumber: 'asc' },
  });

  const explicitNumbers = new Set(
    opts.applicationNumbers.map((n) => n.toUpperCase()),
  );

  const appsToPurge = allApplications.filter(
    (app) =>
      isDemoApplicant(app) ||
      explicitNumbers.has(app.applicationNumber.toUpperCase()),
  );

  const linkedUserIds = appsToPurge
    .map((a) => a.applicantUserId)
    .filter((id): id is string => Boolean(id));

  const demoApplicantUsers = await prisma.user.findMany({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      OR: [
        { email: { endsWith: '@example.com', mode: 'insensitive' } },
        { email: { contains: 'applicant.smoke', mode: 'insensitive' } },
        ...(linkedUserIds.length ? [{ id: { in: linkedUserIds } }] : []),
      ],
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      roles: {
        where: { deletedAt: null },
        include: { role: { select: { slug: true } } },
      },
    },
  });

  const usersToPurge = demoApplicantUsers.filter((u) => {
    if (isProtectedApplicantEmail(u.email)) return false;
    if (linkedUserIds.includes(u.id)) return true;
    return u.roles.some((r) => r.role.slug === 'applicant');
  });

  const appIds = appsToPurge.map((a) => a.id);
  const userIds = [
    ...new Set([...usersToPurge.map((u) => u.id), ...linkedUserIds]),
  ].filter((id) => {
    const user = demoApplicantUsers.find((u) => u.id === id);
    if (!user) return linkedUserIds.includes(id);
    return !isProtectedApplicantEmail(user.email);
  });

  console.log('Admission applications (to remove):');
  if (appsToPurge.length === 0) console.log('  (none)');
  for (const app of appsToPurge) {
    console.log(
      `  - ${app.applicationNumber} · ${app.firstName} ${app.lastName} · ${app.email} · ${app.status}${app.deletedAt ? ' (was soft-deleted)' : ''}`,
    );
  }

  console.log('\nApplicant portal users (demo):');
  if (usersToPurge.length === 0) console.log('  (none)');
  for (const user of usersToPurge) {
    console.log(
      `  - ${user.email}${user.displayName ? ` (${user.displayName})` : ''}`,
    );
  }

  const skipped = allApplications.length - appsToPurge.length;
  console.log(`\nApplications kept (real): ${skipped}`);
  console.log(
    `Total to remove: ${appsToPurge.length} applications, ${userIds.length} users`,
  );

  if (!opts.confirm) {
    console.log('\nDry run only. Re-run with --confirm to apply.');
    console.log('Backup first:');
    console.log(
      '  docker compose exec -T postgres pg_dump -U nep nep_erp > backup_before_applicant_purge.sql\n',
    );
    return;
  }

  if (!appsToPurge.length && !userIds.length) {
    console.log('\nNothing to purge.\n');
    return;
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    if (appIds.length > 0) {
      await tx.frontOfficeEnquiry.updateMany({
        where: { tenantId: tenant.id, admissionApplicationId: { in: appIds } },
        data: { admissionApplicationId: null },
      });

      await tx.admissionApplication.deleteMany({
        where: { id: { in: appIds }, tenantId: tenant.id },
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

  console.log('\nDone.');
  console.log(`  applications hard-deleted: ${appsToPurge.length}`);
  console.log(`  applicant users deactivated: ${userIds.length}`);
  console.log('\nRefresh Admissions → Applications in the admin UI.\n');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
