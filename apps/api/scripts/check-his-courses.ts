import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  if (!tenant) throw new Error('demo tenant not found');

  const dept = await prisma.department.findFirst({
    where: { tenantId: tenant.id, code: 'HIS', deletedAt: null },
    select: { code: true, name: true },
  });
  console.log('Department:', dept ?? 'MISSING HIS');

  const codes = [
    'HIS-100',
    'HIS-150',
    'HIS-200',
    'HIS-201',
    'HIS-250',
    'HIS-253',
    'HIS-300',
    'HIS-301',
    'HIS-302',
    'HIS-303',
    'HIS-350',
    'HIS-353',
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

  for (const legacyCode of ['HIS-304']) {
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
