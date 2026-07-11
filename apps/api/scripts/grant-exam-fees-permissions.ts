/**
 * Grant Semester Exam Fees permissions to admin / finance / exam roles.
 * Run on API host or via:
 *   docker compose ... run --rm api npx tsx scripts/grant-exam-fees-permissions.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SLUGS = [
  'exam-fees:read',
  'exam-fees:manage',
  'exam-fees:collect',
  'exam-fees:verify',
] as const;

const ROLE_SLUGS = [
  'college-admin',
  'super-admin',
  'institution-admin',
  'principal',
  'vice-principal',
  'exam-controller',
  'exam-officer',
  'accountant',
  'cashier',
] as const;

const DESCRIPTIONS: Record<(typeof SLUGS)[number], string> = {
  'exam-fees:read': 'View examination fee sessions, applications, and reports',
  'exam-fees:manage': 'Configure exam fee masters, sessions, and settings',
  'exam-fees:collect': 'Collect manual examination fee payments',
  'exam-fees:verify': 'Verify paid examination applications',
};

function slugsForRole(roleSlug: string): readonly string[] {
  if (roleSlug === 'cashier') {
    return ['exam-fees:read', 'exam-fees:collect'];
  }
  if (roleSlug === 'accountant') {
    return ['exam-fees:read', 'exam-fees:collect', 'exam-fees:verify'];
  }
  if (roleSlug === 'principal' || roleSlug === 'vice-principal') {
    return ['exam-fees:read', 'exam-fees:verify'];
  }
  return SLUGS;
}

async function main() {
  for (const slug of SLUGS) {
    const [resource, ...actionParts] = slug.split(':');
    await prisma.permission.upsert({
      where: { slug },
      update: { description: DESCRIPTIONS[slug] },
      create: {
        slug,
        resource,
        action: actionParts.join(':'),
        description: DESCRIPTIONS[slug],
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

      const allowed = new Set(slugsForRole(roleSlug));
      for (const perm of permissions.filter((p) => allowed.has(p.slug))) {
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

  console.log(`Exam-fees permissions linked (${linked} role-permission rows).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
