/**
 * Grant accommodation permissions to college-admin / super-admin roles.
 * Run: npx tsx scripts/grant-accommodation-permissions.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SLUGS = [
  'accommodation:read',
  'accommodation:manage',
  'accommodation:reports',
] as const;
const ROLE_SLUGS = [
  'college-admin',
  'super-admin',
  'institution-admin',
] as const;

async function main() {
  for (const slug of SLUGS) {
    await prisma.permission.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        resource: 'accommodation',
        action: slug.split(':')[1]!,
        description: `Accommodation ${slug.split(':')[1]}`,
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

      for (const perm of permissions) {
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

  console.log(
    `Accommodation permissions linked (${linked} role-permission rows).`,
  );
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
