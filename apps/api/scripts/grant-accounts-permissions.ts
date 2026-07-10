/**
 * Grant Finance & Accounts permissions to admin roles.
 * Run: npx tsx scripts/grant-accounts-permissions.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SLUGS = ['accounts:read', 'accounts:manage', 'accounts:post'] as const;

const ROLE_SLUGS = [
  'college-admin',
  'super-admin',
  'accountant',
  'institution-admin',
  'principal',
  'vice-principal',
] as const;

async function main() {
  for (const slug of SLUGS) {
    const [resource, ...actionParts] = slug.split(':');
    await prisma.permission.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        resource,
        action: actionParts.join(':'),
        description: `Accounts ${actionParts.join(':')}`,
      },
    });
  }

  const permissions = await prisma.permission.findMany({
    where: { slug: { in: [...SLUGS] } },
  });

  const tenants = await prisma.tenant.findMany({ where: { deletedAt: null } });
  let linked = 0;

  for (const tenant of tenants) {
    for (const roleSlug of ROLE_SLUGS) {
      const role = await prisma.role.findFirst({
        where: { tenantId: tenant.id, slug: roleSlug, deletedAt: null },
      });
      if (!role) continue;

      const slugsForRole =
        roleSlug === 'accountant'
          ? SLUGS
          : roleSlug === 'principal' || roleSlug === 'vice-principal'
            ? (['accounts:read'] as const)
            : SLUGS;

      for (const perm of permissions.filter((p) =>
        slugsForRole.includes(p.slug as (typeof SLUGS)[number]),
      )) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: { roleId: role.id, permissionId: perm.id },
          },
          update: {},
          create: { roleId: role.id, permissionId: perm.id },
        });
        linked += 1;
      }
    }
  }

  console.log(`Accounts permissions linked (${linked} role-permission rows).`);

  const demoTenant = await prisma.tenant.findFirst({
    where: { slug: 'demo', deletedAt: null },
  });
  if (demoTenant) {
    const collegeAdmin = await prisma.role.findFirst({
      where: {
        tenantId: demoTenant.id,
        slug: 'college-admin',
        deletedAt: null,
      },
      include: {
        permissions: {
          include: { permission: true },
        },
      },
    });
    const slugs =
      collegeAdmin?.permissions
        .map((rp) => rp.permission.slug)
        .filter((s) => s.startsWith('accounts:')) ?? [];
    console.log(
      `demo college-admin accounts slugs: ${slugs.join(', ') || 'NONE'}`,
    );
  }

  console.log(
    'Log out and log back in so your session picks up the new permissions.',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
