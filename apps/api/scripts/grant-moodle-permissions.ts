/**
 * Grant moodle:* permissions to admin roles (idempotent).
 */
import { PrismaClient } from '@prisma/client';
import { SEED_PERMISSIONS } from '../prisma/seed-permissions';

const prisma = new PrismaClient();

const SLUGS = [
  'moodle:read',
  'moodle:manage',
  'moodle:sync',
  'moodle:settings',
] as const;

const ROLE_SLUGS = [
  'college-admin',
  'super-admin',
  'university-admin',
] as const;

async function main() {
  for (const slug of SLUGS) {
    const def = SEED_PERMISSIONS.find((p) => p.slug === slug);
    if (!def) continue;
    await prisma.permission.upsert({
      where: { slug },
      update: {
        resource: def.resource,
        action: def.action,
        description: def.description,
      },
      create: {
        slug,
        resource: def.resource,
        action: def.action,
        description: def.description,
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

  console.log(`Moodle permissions linked (${linked} role-permission rows).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
