import { PrismaClient } from '@prisma/client';
import { CHEMISTRY_NEHU_PAPERS } from '../src/modules/academic-engine/domain/chemistry-fyugp-nehu';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  if (!tenant) throw new Error('demo tenant not found');

  for (const paper of CHEMISTRY_NEHU_PAPERS) {
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
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
