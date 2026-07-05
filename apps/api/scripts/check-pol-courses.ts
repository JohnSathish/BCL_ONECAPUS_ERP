import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  if (!tenant) throw new Error('demo tenant not found');

  const dept = await prisma.department.findFirst({
    where: { tenantId: tenant.id, code: 'POL', deletedAt: null },
    select: { code: true, name: true },
  });
  console.log('Department:', dept ?? 'MISSING POL');

  const codes = [
    'POL-100',
    'POL-150',
    'POL-200',
    'POL-201',
    'POL-250',
    'POL-253',
    'POL-300',
    'POL-301',
    'POL-302',
    'POL-303',
    'POL-350',
    'POL-353',
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

  for (const legacyCode of ['POL-304']) {
    const legacy = await prisma.course.findFirst({
      where: { tenantId: tenant.id, code: legacyCode, deletedAt: null },
      select: { code: true, title: true },
    });
    if (legacy) {
      console.log(`Legacy still active: ${legacy.code} — ${legacy.title}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
