/**
 * One-shot sync: ensure official-documents permissions exist and are granted to key roles.
 * Run: npx tsx prisma/sync-official-documents-permissions.ts
 */
import { PrismaClient } from '@prisma/client';
import { SEED_PERMISSIONS } from './seed-permissions';

const OFFICIAL_DOC_SLUGS = [
  'official-documents:read',
  'official-documents:manage',
  'official-documents:approve',
  'official-documents:publish',
  'official-documents:archive',
  'official-documents:settings',
] as const;

const ROLE_GRANTS: Record<string, readonly string[]> = {
  'college-admin': OFFICIAL_DOC_SLUGS,
  'super-admin': OFFICIAL_DOC_SLUGS,
  principal: OFFICIAL_DOC_SLUGS,
  'vice-principal': [
    'official-documents:read',
    'official-documents:manage',
    'official-documents:approve',
    'official-documents:publish',
    'official-documents:archive',
  ],
  'erp-administrator': [
    'official-documents:read',
    'official-documents:manage',
    'official-documents:settings',
  ],
  'institution-admin': [
    'official-documents:read',
    'official-documents:manage',
    'official-documents:settings',
  ],
};

const prisma = new PrismaClient();

async function main() {
  const officialDefs = SEED_PERMISSIONS.filter((p) =>
    OFFICIAL_DOC_SLUGS.includes(p.slug as (typeof OFFICIAL_DOC_SLUGS)[number]),
  );

  for (const p of officialDefs) {
    await prisma.permission.upsert({
      where: { slug: p.slug },
      update: {
        resource: p.resource,
        action: p.action,
        description: p.description,
      },
      create: p,
    });
  }

  const perms = await prisma.permission.findMany({
    where: { slug: { in: [...OFFICIAL_DOC_SLUGS] } },
  });
  const permBySlug = new Map(perms.map((p) => [p.slug, p.id]));

  const tenants = await prisma.tenant.findMany({ where: { deletedAt: null } });
  let grants = 0;

  for (const tenant of tenants) {
    for (const [roleSlug, slugs] of Object.entries(ROLE_GRANTS)) {
      const role = await prisma.role.findFirst({
        where: { tenantId: tenant.id, slug: roleSlug, deletedAt: null },
      });
      if (!role) continue;

      for (const slug of slugs) {
        const permissionId = permBySlug.get(slug);
        if (!permissionId) continue;
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: { roleId: role.id, permissionId },
          },
          update: {},
          create: { roleId: role.id, permissionId },
        });
        grants += 1;
      }
    }
  }

  console.log(
    `Synced ${officialDefs.length} permissions; ensured ${grants} role grants across ${tenants.length} tenant(s).`,
  );
  console.log(
    'Users must log out and sign in again to refresh JWT permissions.',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
