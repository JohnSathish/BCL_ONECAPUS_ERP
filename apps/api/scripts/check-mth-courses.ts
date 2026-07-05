import { PrismaClient } from '@prisma/client';
import { MATHEMATICS_NEHU_PAPERS } from '../src/modules/academic-engine/domain/mathematics-fyugp-nehu';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  if (!tenant) throw new Error('demo tenant not found');

  for (const paper of MATHEMATICS_NEHU_PAPERS) {
    const course = await prisma.course.findFirst({
      where: { tenantId: tenant.id, code: paper.code, deletedAt: null },
      select: {
        code: true,
        title: true,
        deliveryType: true,
        theoryCredits: true,
        practicalCredits: true,
        hasPractical: true,
        labRequired: true,
      },
    });
    console.log(
      course
        ? `${course.code}: ${course.title} (${course.deliveryType}, T${course.theoryCredits}/P${course.practicalCredits}, lab=${course.labRequired})`
        : `MISSING ${paper.code}`,
    );
  }

  for (const legacy of ['MTH-302 B', 'MTH-352 B', 'MTH-352B', 'MTH-304']) {
    const row = await prisma.course.findFirst({
      where: { tenantId: tenant.id, code: legacy, deletedAt: null },
    });
    console.log(
      row ? `LEGACY ${legacy} still active` : `LEGACY ${legacy} retired`,
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
