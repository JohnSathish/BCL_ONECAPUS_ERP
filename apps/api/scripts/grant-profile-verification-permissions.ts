/**
 * Grant Student Profile Verification permissions to admin roles.
 * Run: npx tsx scripts/grant-profile-verification-permissions.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SLUGS = [
  'students:profile-verify',
  'students:profile-policy',
  'students:verify-documents',
  'students:self-update',
] as const;

const FULL_ACCESS_ROLES = [
  'college-admin',
  'super-admin',
  'institution-admin',
  'academic-admin',
  'admission-admin',
] as const;

const VERIFY_ONLY_ROLES = [
  'principal',
  'vice-principal',
  'hod',
  'office-admin',
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
        description:
          slug === 'students:profile-verify'
            ? 'Verify student profile update requests'
            : slug === 'students:profile-policy'
              ? 'Configure student profile update approval policy'
              : slug === 'students:verify-documents'
                ? 'Verify student documents'
                : 'Limited student self profile update',
      },
    });
  }

  const permissions = await prisma.permission.findMany({
    where: { slug: { in: [...SLUGS] } },
  });
  const bySlug = new Map(permissions.map((p) => [p.slug, p]));

  const tenants = await prisma.tenant.findMany({ where: { deletedAt: null } });
  let linked = 0;

  for (const tenant of tenants) {
    for (const roleSlug of FULL_ACCESS_ROLES) {
      const role = await prisma.role.findFirst({
        where: { tenantId: tenant.id, slug: roleSlug, deletedAt: null },
      });
      if (!role) continue;
      for (const slug of SLUGS) {
        if (slug === 'students:self-update') continue;
        const perm = bySlug.get(slug);
        if (!perm) continue;
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

    for (const roleSlug of VERIFY_ONLY_ROLES) {
      const role = await prisma.role.findFirst({
        where: { tenantId: tenant.id, slug: roleSlug, deletedAt: null },
      });
      if (!role) continue;
      for (const slug of [
        'students:profile-verify',
        'students:verify-documents',
      ] as const) {
        const perm = bySlug.get(slug);
        if (!perm) continue;
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

    // Student role gets self-update
    const studentRole = await prisma.role.findFirst({
      where: { tenantId: tenant.id, slug: 'student', deletedAt: null },
    });
    const selfUpdate = bySlug.get('students:self-update');
    if (studentRole && selfUpdate) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: studentRole.id,
            permissionId: selfUpdate.id,
          },
        },
        update: {},
        create: { roleId: studentRole.id, permissionId: selfUpdate.id },
      });
      linked += 1;
    }
  }

  console.log(
    `Profile verification permissions linked (${linked} role-permission rows).`,
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
