/**
 * Seed campus-competitions permissions and grant to admin/staff/student roles.
 * Run: npx tsx scripts/grant-campus-competitions-permissions.ts
 */
import { PrismaClient } from '@prisma/client';
import { SEED_PERMISSIONS } from '../prisma/seed-permissions';

const prisma = new PrismaClient();

const CC_SLUGS = [
  'campus-competitions:read',
  'campus-competitions:manage',
  'campus-competitions:allocate',
  'campus-competitions:score',
  'campus-competitions:approve',
  'campus-competitions:certificates',
  'campus-competitions:self',
] as const;

const ADMIN_ROLES = [
  'super-admin',
  'college-admin',
  'institution-admin',
  'principal',
  'vice-principal',
] as const;

const STAFF_SCORE_ROLES = ['hod', 'faculty', 'teacher'] as const;

async function ensurePerm(slug: string) {
  const def = SEED_PERMISSIONS.find((p) => p.slug === slug);
  if (!def) throw new Error(`Missing seed def for ${slug}`);
  const existing = await prisma.permission.findFirst({
    where: { slug, deletedAt: null },
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
    return existing;
  }
  return prisma.permission.create({ data: def });
}

async function link(roleId: string, permissionId: string) {
  const existing = await prisma.rolePermission.findFirst({
    where: { roleId, permissionId },
  });
  if (!existing) {
    await prisma.rolePermission.create({ data: { roleId, permissionId } });
    return true;
  }
  return false;
}

async function main() {
  const perms: Record<string, { id: string; slug: string }> = {};
  for (const slug of CC_SLUGS) {
    perms[slug] = await ensurePerm(slug);
  }
  console.log('Permissions ensured:', CC_SLUGS.join(', '));

  const tenants = await prisma.tenant.findMany({ where: { deletedAt: null } });
  let linked = 0;

  for (const tenant of tenants) {
    for (const roleSlug of ADMIN_ROLES) {
      const role = await prisma.role.findFirst({
        where: { tenantId: tenant.id, slug: roleSlug, deletedAt: null },
      });
      if (!role) continue;
      for (const slug of CC_SLUGS) {
        if (await link(role.id, perms[slug].id)) linked += 1;
      }
    }

    for (const roleSlug of STAFF_SCORE_ROLES) {
      const role = await prisma.role.findFirst({
        where: { tenantId: tenant.id, slug: roleSlug, deletedAt: null },
      });
      if (!role) continue;
      for (const slug of [
        'campus-competitions:read',
        'campus-competitions:score',
        'campus-competitions:certificates',
      ] as const) {
        if (await link(role.id, perms[slug].id)) linked += 1;
      }
    }

    const studentRole = await prisma.role.findFirst({
      where: {
        tenantId: tenant.id,
        slug: { in: ['student', 'students'] },
        deletedAt: null,
      },
    });
    if (studentRole) {
      if (await link(studentRole.id, perms['campus-competitions:self'].id)) {
        linked += 1;
      }
      if (await link(studentRole.id, perms['campus-competitions:read'].id)) {
        linked += 1;
      }
    }
  }

  console.log(`New role-permission links: ${linked}`);
  console.log('Done. Log out/in to refresh JWT permissions.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
