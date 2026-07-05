import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  if (!tenant) throw new Error('demo tenant not found');

  const dept = await prisma.department.findFirst({
    where: { tenantId: tenant.id, code: 'SOC', deletedAt: null },
    select: { code: true, name: true },
  });
  console.log('Department:', dept ?? 'MISSING SOC');

  const codes = [
    'SOC-100',
    'SOC-150',
    'SOC-200',
    'SOC-201',
    'SOC-250',
    'SOC-253',
    'SOC-300',
    'SOC-301',
    'SOC-302',
    'SOC-303',
    'SOC-350',
    'SOC-353',
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

  for (const legacyCode of ['SOC-304']) {
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
