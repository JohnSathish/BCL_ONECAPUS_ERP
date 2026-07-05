import { PrismaClient } from '@prisma/client';
import { geographyPracticalCourseCodes } from '../src/modules/academic-engine/domain/geography-fyugp-nehu.util';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  if (!tenant) throw new Error('demo tenant not found');

  const dept = await prisma.department.findFirst({
    where: { tenantId: tenant.id, code: 'GEO', deletedAt: null },
    select: { code: true, name: true },
  });
  console.log('Department:', dept ?? 'MISSING GEO');

  const codes = [
    'GEO-100',
    'GEO-150',
    'GEO-200',
    'GEO-201',
    'GEO-250',
    'GEO-252',
    'GEO-253',
    'GEO-300',
    'GEO-301',
    'GEO-302',
    'GEO-303',
    'GEO-350',
    'GEO-353',
  ];

  const practicalCodes = new Set(geographyPracticalCourseCodes());

  for (const code of codes) {
    const course = await prisma.course.findFirst({
      where: { tenantId: tenant.id, code, deletedAt: null },
      select: {
        code: true,
        title: true,
        deliveryType: true,
        hasPractical: true,
        labRequired: true,
        practicalCredits: true,
      },
    });
    if (!course) {
      console.log(`MISSING ${code}`);
      continue;
    }
    const practicalFlag = practicalCodes.has(code)
      ? ` practical=${course.hasPractical} lab=${course.labRequired} credits=${course.practicalCredits}`
      : '';
    console.log(
      `${course.code}: ${course.title} (${course.deliveryType})${practicalFlag}`,
    );
  }

  for (const legacyCode of ['GEO-304']) {
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
