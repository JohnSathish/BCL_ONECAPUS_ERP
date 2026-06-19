/**
 * Seed permissions + admin roles without Prisma upsert (works when unique indexes are missing).
 *
 * Usage:
 *   npx tsx scripts/seed-rbac-only.ts
 *   npx tsx scripts/seed-rbac-only.ts admin@donboscocollege.ac.in
 */
import { PrismaClient } from '@prisma/client';
import { SEED_PERMISSIONS } from '../prisma/seed-permissions';

const prisma = new PrismaClient();

const DEFAULT_TENANT_SLUG = 'demo';
const ADMIN_ROLE_SLUGS = [
  { slug: 'super-admin', name: 'Super Admin' },
  { slug: 'college-admin', name: 'College Admin' },
] as const;

async function ensurePermission(def: (typeof SEED_PERMISSIONS)[number]) {
  const existing = await prisma.permission.findFirst({
    where: { slug: def.slug, deletedAt: null },
  });
  if (existing) {
    await prisma.permission.update({
      where: { id: existing.id },
      data: {
        resource: def.resource,
        action: def.action,
        description: def.description,
        deletedAt: null,
      },
    });
    return existing.id;
  }

  const created = await prisma.permission.create({ data: def });
  return created.id;
}

async function ensurePermissions() {
  let created = 0;
  let updated = 0;

  for (const def of SEED_PERMISSIONS) {
    const before = await prisma.permission.findFirst({
      where: { slug: def.slug, deletedAt: null },
      select: { id: true },
    });
    await ensurePermission(def);
    if (before) updated += 1;
    else created += 1;
  }

  const total = await prisma.permission.count({ where: { deletedAt: null } });
  console.log(
    `Permissions: ${total} active (${created} created, ${updated} updated)`,
  );
  return total;
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
      `Tenant "${DEFAULT_TENANT_SLUG}" not found. Restore data or run full db:seed after repairing indexes.`,
    );
  }

  if (tenants.length > 1) {
    console.warn(
      `Multiple "${DEFAULT_TENANT_SLUG}" tenants — using oldest (${tenants[0]!.id})`,
    );
  }

  return tenants[0]!;
}

async function ensureRole(
  tenantId: string,
  slug: string,
  name: string,
  permissionIds: string[],
) {
  let role = await prisma.role.findFirst({
    where: { tenantId, slug, deletedAt: null },
  });

  if (!role) {
    role = await prisma.role.create({
      data: { tenantId, slug, name, isSystem: true },
    });
    console.log(`  ✓ created role: ${slug}`);
  } else {
    await prisma.role.update({
      where: { id: role.id },
      data: { name, deletedAt: null },
    });
    console.log(`  ✓ role exists: ${slug}`);
  }

  await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });

  for (const permissionId of permissionIds) {
    await prisma.rolePermission.create({
      data: { roleId: role.id, permissionId },
    });
  }

  return role;
}

async function assignRole(userId: string, roleId: string) {
  const existing = await prisma.userRole.findFirst({
    where: { userId, roleId, deletedAt: null },
  });
  if (!existing) {
    await prisma.userRole.create({ data: { userId, roleId } });
  }
}

async function main() {
  const adminEmail = process.argv[2]?.trim().toLowerCase();

  console.log('=== RBAC-only seed (no upsert) ===\n');

  await ensurePermissions();

  const tenant = await resolveTenant(adminEmail);
  console.log(`Tenant: ${tenant.name} (${tenant.id})\n`);

  const permissions = await prisma.permission.findMany({
    where: { deletedAt: null },
    select: { id: true },
  });
  const permissionIds = permissions.map((p) => p.id);

  console.log('Ensuring admin roles…');
  const roles = [];
  for (const def of ADMIN_ROLE_SLUGS) {
    roles.push(await ensureRole(tenant.id, def.slug, def.name, permissionIds));
  }

  if (adminEmail) {
    const user = await prisma.user.findFirst({
      where: {
        tenantId: tenant.id,
        email: adminEmail,
        deletedAt: null,
      },
    });

    if (!user) {
      console.warn(`Admin user not found in tenant: ${adminEmail}`);
    } else {
      for (const role of roles) {
        await assignRole(user.id, role.id);
      }
      console.log(`\n✓ assigned super-admin + college-admin to ${adminEmail}`);
    }
  }

  console.log('\nDone. Log out and log back in to refresh permissions.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
