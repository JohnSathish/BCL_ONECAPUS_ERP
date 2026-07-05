import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  if (!tenant) throw new Error('demo tenant not found');

  const codes = [
    'AEC-120',
    'AEC-121',
    'AEC-122',
    'AEC-123',
    'MDC-110',
    'MDC-115',
  ];
  for (const code of codes) {
    const course = await prisma.course.findFirst({
      where: { tenantId: tenant.id, code, deletedAt: null },
      select: { code: true, title: true },
    });
    console.log(course ? `${course.code}: ${course.title}` : `MISSING ${code}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
