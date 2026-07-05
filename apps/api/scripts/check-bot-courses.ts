import { PrismaClient } from '@prisma/client';
import { BOTANY_NEHU_PAPERS } from '../src/modules/academic-engine/domain/botany-fyugp-nehu';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  if (!tenant) throw new Error('demo tenant not found');

  for (const paper of BOTANY_NEHU_PAPERS) {
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

  const legacy = await prisma.course.findFirst({
    where: { tenantId: tenant.id, code: 'BOT-302 M', deletedAt: null },
  });
  console.log(
    legacy ? 'LEGACY BOT-302 M still active' : 'LEGACY BOT-302 M retired',
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
