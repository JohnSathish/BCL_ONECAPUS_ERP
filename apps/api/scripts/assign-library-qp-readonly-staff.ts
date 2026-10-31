/**
 * Give three library staff full library and question-paper rights,
 * and view-only rights everywhere else. Other accounts are left as they are.
 *
 *   npx tsx scripts/assign-library-qp-readonly-staff.ts
 */
import { PrismaClient } from '@prisma/client';
import { SEED_PERMISSIONS } from '../prisma/seed-permissions';
import {
  LIBRARY_QP_READONLY_EMAILS,
  LIBRARY_QP_READONLY_ROLE,
  libraryQpReadonlyPermissions,
} from '../src/common/permissions/library-qp-readonly';

const prisma = new PrismaClient();
const TENANT_SLUG = 'don-bosco-tura';

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: TENANT_SLUG, deletedAt: null },
  });
  if (!tenant) {
    throw new Error(`Tenant ${TENANT_SLUG} was not found`);
  }

  const catalog = SEED_PERMISSIONS.map((row) => row.slug);
  const wanted = libraryQpReadonlyPermissions(catalog);
  const permissions = await prisma.permission.findMany({
    where: { slug: { in: wanted }, deletedAt: null },
  });
  const found = new Set(permissions.map((row) => row.slug));
  const missing = wanted.filter((slug) => !found.has(slug));
  if (missing.length) {
    console.warn(`Permissions not in the database yet: ${missing.join(', ')}`);
  }

  let role = await prisma.role.findFirst({
    where: {
      tenantId: tenant.id,
      slug: LIBRARY_QP_READONLY_ROLE,
      deletedAt: null,
    },
  });
  if (!role) {
    role = await prisma.role.create({
      data: {
        tenantId: tenant.id,
        slug: LIBRARY_QP_READONLY_ROLE,
        name: 'Library and question papers',
        description:
          'Full library and question-paper repository. Every other module is view only.',
        isSystem: true,
      },
    });
  }

  await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
  if (permissions.length) {
    await prisma.rolePermission.createMany({
      data: permissions.map((row) => ({
        roleId: role.id,
        permissionId: row.id,
      })),
    });
  }

  for (const email of LIBRARY_QP_READONLY_EMAILS) {
    const user = await prisma.user.findFirst({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        email: { equals: email, mode: 'insensitive' },
      },
    });
    if (!user) {
      console.warn(`No active user for ${email}`);
      continue;
    }

    const assignments = await prisma.userRole.findMany({
      where: { userId: user.id, deletedAt: null },
      include: { role: { select: { slug: true } } },
    });
    for (const row of assignments) {
      if (row.role.slug === LIBRARY_QP_READONLY_ROLE) continue;
      await prisma.userRole.update({
        where: { id: row.id },
        data: { deletedAt: new Date() },
      });
    }

    await prisma.userPermission.deleteMany({ where: { userId: user.id } });

    const already = assignments.some(
      (row) => row.role.slug === LIBRARY_QP_READONLY_ROLE,
    );
    if (!already) {
      await prisma.userRole.create({
        data: { userId: user.id, roleId: role.id },
      });
    }

    await prisma.refreshSession.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    console.log(
      `Updated ${email}: library and question papers, view only elsewhere`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
