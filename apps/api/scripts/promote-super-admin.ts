/**
 * Promote a user to super-admin with full permissions.
 * Run: npx tsx scripts/promote-super-admin.ts [email]
 * Default email: johnsathish16@gmail.com
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_EMAIL = 'johnsathish16@gmail.com';
const SUPER_ADMIN_ROLE_SLUGS = ['super-admin', 'college-admin'] as const;
const ROLES_TO_REMOVE = ['faculty', 'staff'] as const;

async function syncAllPermissionsToRole(roleId: string) {
  const permissions = await prisma.permission.findMany({
    where: { deletedAt: null },
    select: { id: true },
  });

  for (const permission of permissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: { roleId, permissionId: permission.id },
      },
      update: {},
      create: { roleId, permissionId: permission.id },
    });
  }

  return permissions.length;
}

async function main() {
  const email = (process.argv[2] ?? DEFAULT_EMAIL).trim().toLowerCase();

  const user = await prisma.user.findFirst({
    where: {
      email: { equals: email, mode: 'insensitive' },
      deletedAt: null,
    },
    include: {
      tenant: { select: { id: true, slug: true, name: true } },
      roles: {
        where: { deletedAt: null },
        include: { role: { select: { id: true, slug: true, name: true } } },
      },
    },
  });

  if (!user) {
    throw new Error(`No active user found with email: ${email}`);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      isActive: true,
      emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
    },
  });

  const rolesToRemove = await prisma.role.findMany({
    where: {
      tenantId: user.tenantId,
      slug: { in: [...ROLES_TO_REMOVE] },
      deletedAt: null,
    },
    select: { id: true, slug: true },
  });

  if (rolesToRemove.length > 0) {
    await prisma.userRole.deleteMany({
      where: {
        userId: user.id,
        roleId: { in: rolesToRemove.map((r) => r.id) },
      },
    });
  }

  const assigned: string[] = [];

  for (const roleSlug of SUPER_ADMIN_ROLE_SLUGS) {
    const role = await prisma.role.findFirst({
      where: {
        tenantId: user.tenantId,
        slug: roleSlug,
        deletedAt: null,
      },
    });

    if (!role) {
      console.warn(
        `Role "${roleSlug}" not found for tenant ${user.tenant.slug}; skipping.`,
      );
      continue;
    }

    const permissionCount = await syncAllPermissionsToRole(role.id);

    const existing = await prisma.userRole.findFirst({
      where: { userId: user.id, roleId: role.id, deletedAt: null },
    });

    if (!existing) {
      await prisma.userRole.create({
        data: { userId: user.id, roleId: role.id },
      });
    }

    assigned.push(`${roleSlug} (${permissionCount} permissions)`);
  }

  const updatedRoles = await prisma.userRole.findMany({
    where: { userId: user.id, deletedAt: null },
    include: { role: { select: { slug: true, name: true } } },
  });

  console.log('Super admin promotion complete.');
  console.log(`  Tenant: ${user.tenant.name} (${user.tenant.slug})`);
  console.log(`  User:   ${user.email}`);
  console.log(
    `  Roles:  ${updatedRoles.map((r) => r.role.slug).join(', ') || '(none)'}`,
  );
  console.log(`  Assigned: ${assigned.join('; ') || 'none'}`);
  if (rolesToRemove.length > 0) {
    console.log(`  Removed: ${rolesToRemove.map((r) => r.slug).join(', ')}`);
  }
  console.log(
    'Log out and log back in so your session picks up the new roles.',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
