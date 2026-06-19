/**
 * Production / LAN bootstrap for Don Bosco College ERP.
 *
 * Registers tenant domains, optional admin user, and prints next steps.
 *
 * Usage:
 *   npx tsx scripts/production-bootstrap.ts
 *   npx tsx scripts/production-bootstrap.ts --register-host 192.168.1.50
 *   npx tsx scripts/production-bootstrap.ts --admin-email admin@donboscocollege.ac.in
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEFAULT_TENANT_SLUG = 'demo';
const PRODUCTION_HOSTS = [
  'erp.donboscocollege.ac.in',
  'admissions.donboscocollege.ac.in',
  'library.donboscocollege.ac.in',
];

function parseArgs(argv: string[]) {
  const opts: {
    registerHosts: string[];
    adminEmail?: string;
    adminPassword?: string;
    adminName?: string;
  } = { registerHosts: [] };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--register-host' && argv[i + 1]) {
      opts.registerHosts.push(argv[i + 1]!.trim().toLowerCase());
      i += 1;
    } else if (arg === '--admin-email' && argv[i + 1]) {
      opts.adminEmail = argv[i + 1]!.trim().toLowerCase();
      i += 1;
    } else if (arg === '--admin-password' && argv[i + 1]) {
      opts.adminPassword = argv[i + 1]!;
      i += 1;
    } else if (arg === '--admin-name' && argv[i + 1]) {
      opts.adminName = argv[i + 1]!.trim();
      i += 1;
    }
  }

  return opts;
}

async function registerHost(tenantId: string, host: string) {
  const normalized = host.split(':')[0]!.toLowerCase();
  await prisma.tenantDomain.upsert({
    where: { host: normalized },
    update: { tenantId, verified: true, deletedAt: null },
    create: { tenantId, host: normalized, verified: true },
  });
  console.log(`  ✓ tenant domain: ${normalized}`);
}

async function clearLoginLockouts(tenantId: string, email: string) {
  const normalized = email.trim().toLowerCase();
  const cleared = await prisma.loginAttempt.deleteMany({
    where: { tenantId, email: normalized },
  });
  if (cleared.count > 0) {
    console.log(
      `  ✓ cleared ${cleared.count} login lockout(s) for ${normalized}`,
    );
  }
}

async function resolveTenant(adminEmail?: string) {
  const duplicates = await prisma.$queryRaw<{ slug: string; n: bigint }[]>`
    SELECT slug, COUNT(*)::bigint AS n
    FROM platform.tenants
    WHERE deleted_at IS NULL
    GROUP BY slug
    HAVING COUNT(*) > 1
  `;

  if (duplicates.length > 0) {
    console.warn(
      'Duplicate tenant slugs detected:',
      duplicates.map((d) => `${d.slug}×${d.n}`).join(', '),
    );
  }

  if (adminEmail) {
    const user = await prisma.user.findFirst({
      where: {
        email: { equals: adminEmail, mode: 'insensitive' },
        deletedAt: null,
      },
      include: { tenant: true },
    });
    if (user?.tenant) {
      console.log(
        `Tenant resolved via admin user: ${user.tenant.name} (${user.tenant.slug})`,
      );
      return user.tenant;
    }
  }

  const tenants = await prisma.tenant.findMany({
    where: { slug: DEFAULT_TENANT_SLUG, deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });

  if (tenants.length === 0) {
    throw new Error(
      `Tenant "${DEFAULT_TENANT_SLUG}" not found. Run: npm run db:seed`,
    );
  }

  if (tenants.length > 1) {
    console.warn(
      `Multiple "${DEFAULT_TENANT_SLUG}" tenants — using oldest (${tenants[0]!.id})`,
    );
  }

  return tenants[0]!;
}

async function ensureTenantLicense(tenantId: string, createdById?: string) {
  const existing = await prisma.tenantLicense.findUnique({
    where: { tenantId },
  });
  if (existing) {
    console.log('  ✓ tenant license exists');
    return;
  }

  const start = new Date();
  const expiry = new Date(start);
  expiry.setFullYear(expiry.getFullYear() + 1);
  const year = start.getFullYear();
  const suffix = tenantId.replace(/-/g, '').slice(0, 4).toUpperCase();

  await prisma.tenantLicense.create({
    data: {
      tenantId,
      licenseNumber: `BCL-${year}-${suffix}`,
      licenseType: 'ANNUAL_1Y',
      subscriptionPlan: 'Annual License',
      startDate: start,
      expiryDate: expiry,
      gracePeriodDays: 15,
      maxStudents: 5000,
      maxStaff: 500,
      storageLimitMb: 10240,
      ...(createdById ? { createdById } : {}),
    },
  });
  console.log(
    `  ✓ created tenant license (expires ${expiry.toISOString().slice(0, 10)})`,
  );
}

async function ensureAdmin(
  tenantId: string,
  email: string,
  password: string,
  displayName: string,
) {
  await clearLoginLockouts(tenantId, email);

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { tenantId_email: { tenantId, email } },
    update: {
      passwordHash,
      displayName,
      isActive: true,
      emailVerifiedAt: new Date(),
      deletedAt: null,
    },
    create: {
      tenantId,
      email,
      passwordHash,
      displayName,
      isActive: true,
      emailVerifiedAt: new Date(),
    },
  });

  const superAdmin = await prisma.role.findFirst({
    where: { tenantId, slug: 'super-admin', deletedAt: null },
  });
  if (superAdmin) {
    const existingRole = await prisma.userRole.findFirst({
      where: {
        userId: user.id,
        roleId: superAdmin.id,
        deletedAt: null,
      },
    });
    if (!existingRole) {
      await prisma.userRole.create({
        data: { userId: user.id, roleId: superAdmin.id },
      });
      console.log(`  ✓ assigned super-admin role`);
    } else {
      console.log(`  ✓ super-admin role already assigned`);
    }
  } else {
    console.warn('  ⚠ super-admin role not found — run db:seed first');
  }

  console.log(`  ✓ admin user: ${email} (password updated, account active)`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  const tenant = await resolveTenant(opts.adminEmail);
  console.log(`\nBootstrapping tenant: ${tenant.name} (${tenant.slug})\n`);

  console.log('Registering production domains…');
  for (const host of PRODUCTION_HOSTS) {
    await registerHost(tenant.id, host);
  }

  if (opts.registerHosts.length) {
    console.log('Registering LAN / custom hosts…');
    for (const host of opts.registerHosts) {
      await registerHost(tenant.id, host);
    }
  }

  let adminUserId: string | undefined;
  if (opts.adminEmail && opts.adminPassword) {
    console.log('Creating / updating production admin…');
    await ensureAdmin(
      tenant.id,
      opts.adminEmail,
      opts.adminPassword,
      opts.adminName ?? 'College Administrator',
    );
    const adminUser = await prisma.user.findFirst({
      where: {
        tenantId: tenant.id,
        email: opts.adminEmail,
        deletedAt: null,
      },
      select: { id: true },
    });
    adminUserId = adminUser?.id;
  }

  console.log('Ensuring tenant license…');
  await ensureTenantLicense(tenant.id, adminUserId);

  console.log('\nDone. Next steps:');
  console.log(
    '  1. bash scripts/deploy/vps-migrate.sh  (if not already migrated)',
  );
  console.log('  2. Set WEB_ORIGIN and JWT secrets in production .env');
  console.log('  3. For LAN testing: npm run dev:lan');
  console.log('  4. For live server: see docs/DEPLOY_DBC_PRODUCTION.md\n');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
