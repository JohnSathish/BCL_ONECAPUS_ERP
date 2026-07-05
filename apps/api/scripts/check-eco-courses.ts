import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  if (!tenant) throw new Error('demo tenant not found');

  const codes = [
    'ECO-100',
    'ECO-150',
    'ECO-200',
    'ECO-201',
    'ECO-250',
    'ECO-253',
    'ECO-300',
    'ECO-301',
    'ECO-302',
    'ECO-303',
    'ECO-304',
    'ECO-350',
    'ECO-353',
  ];

  for (const code of codes) {
    const course = await prisma.course.findFirst({
      where: { tenantId: tenant.id, code, deletedAt: null },
      select: { code: true, title: true, deliveryType: true },
    });
    console.log(
      course
        ? `${course.code}: ${course.title} (${course.deliveryType})`
        : `MISSING ${code}`,
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
