import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  if (!tenant) throw new Error('demo tenant not found');

  const dept = await prisma.department.findFirst({
    where: { tenantId: tenant.id, code: 'ENG', deletedAt: null },
    select: { code: true, name: true },
  });
  console.log('Department:', dept ?? 'MISSING ENG');

  const codes = [
    'ENG-100',
    'ENG-150',
    'ENG-200',
    'ENG-201',
    'ENG-250',
    'ENG-253',
    'ENG-300',
    'ENG-301',
    'ENG-302',
    'ENG-303',
    'ENG-350',
    'ENG-353',
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

  for (const legacyCode of ['ENG-304']) {
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
