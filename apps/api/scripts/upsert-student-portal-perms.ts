import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.permission.upsert({
    where: { slug: 'student:portal:self' },
    create: {
      slug: 'student:portal:self',
      resource: 'student',
      action: 'portal:self',
      description: 'Access own student portal profile and dashboard',
    },
    update: {},
  });

  const role = await prisma.role.findFirst({ where: { slug: 'student' } });
  if (!role) {
    console.log('Student role not found');
    return;
  }

  const slugs = ['student:portal:self', 'fees:read', 'exam:view'];
  const perms = await prisma.permission.findMany({
    where: { slug: { in: slugs } },
  });
  for (const perm of perms) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: { roleId: role.id, permissionId: perm.id },
      },
      create: { roleId: role.id, permissionId: perm.id },
      update: {},
    });
  }
  console.log('Updated student role permissions:', slugs.join(', '));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
