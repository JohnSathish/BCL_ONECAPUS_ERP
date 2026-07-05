import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  if (!tenant) throw new Error('demo tenant not found');

  const dept = await prisma.department.findFirst({
    where: { tenantId: tenant.id, code: 'PHI', deletedAt: null },
    select: { code: true, name: true },
  });
  console.log('Department:', dept ?? 'MISSING PHI');

  const codes = [
    'PHI-100',
    'PHI-150',
    'PHI-200',
    'PHI-201',
    'PHI-250',
    'PHI-253',
    'PHI-300',
    'PHI-301',
    'PHI-302',
    'PHI-303',
    'PHI-350',
    'PHI-353',
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

  for (const legacyCode of ['PHI-304']) {
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
