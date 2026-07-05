import { PrismaClient } from '@prisma/client';
import { COMMERCE_NEHU_PAPERS } from '../src/modules/academic-engine/domain/commerce-fyugp-nehu';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  if (!tenant) throw new Error('demo tenant not found');

  for (const paper of COMMERCE_NEHU_PAPERS) {
    const course = await prisma.course.findFirst({
      where: { tenantId: tenant.id, code: paper.code, deletedAt: null },
      select: {
        code: true,
        title: true,
        deliveryType: true,
        theoryCredits: true,
        totalContactHours: true,
      },
    });
    console.log(
      course
        ? `${course.code}: ${course.title} (${course.deliveryType}, ${course.totalContactHours}h)`
        : `MISSING ${paper.code}`,
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
