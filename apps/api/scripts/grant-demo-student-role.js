const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'demo', deletedAt: null },
  });
  if (!tenant) throw new Error('tenant demo missing');

  const role = await prisma.role.findFirst({
    where: { tenantId: tenant.id, slug: 'student', deletedAt: null },
  });
  if (!role) throw new Error('student role missing');

  const user = await prisma.user.findFirst({
    where: {
      tenantId: tenant.id,
      email: 'demo.student.001@demo.edu',
      deletedAt: null,
    },
  });
  if (!user) throw new Error('demo student user missing');

  const existing = await prisma.userRole.findFirst({
    where: { userId: user.id, roleId: role.id, deletedAt: null },
  });

  if (existing) {
    console.log('role already present');
    return;
  }

  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  console.log('role assigned');
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
