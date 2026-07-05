import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  if (!tenant) throw new Error('demo tenant not found');

  const dept = await prisma.department.findFirst({
    where: { tenantId: tenant.id, code: 'EDN', deletedAt: null },
    select: { code: true, name: true },
  });
  console.log('Department:', dept ?? 'MISSING EDN');

  const codes = [
    'EDN-100',
    'EDN-150',
    'EDN-200',
    'EDN-201',
    'EDN-250',
    'EDN-253',
    'EDN-300',
    'EDN-301',
    'EDN-302',
    'EDN-303',
    'EDN-350',
    'EDN-353',
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

  const legacy = await prisma.course.findMany({
    where: {
      tenantId: tenant.id,
      code: { startsWith: 'EDU-' },
      deletedAt: null,
    },
    select: { code: true },
    orderBy: { code: 'asc' },
  });
  if (legacy.length) {
    console.log(
      'Legacy EDU-* still active:',
      legacy.map((c) => c.code).join(', '),
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
