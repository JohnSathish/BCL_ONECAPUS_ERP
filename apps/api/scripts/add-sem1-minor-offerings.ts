import { PrismaClient } from '@prisma/client';
import { ensureSem1MinorOfferings } from '../prisma/ensure-sem1-minor-offerings';

const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany({
    where: { deletedAt: null },
    select: { id: true, slug: true },
  });
  if (!tenants.length) throw new Error('No tenant found');

  for (const tenant of tenants) {
    const result = await ensureSem1MinorOfferings(prisma, tenant.id);
    console.log(
      `${tenant.slug}: created ${result.created}, already present ${result.alreadyPresent}, COM minors ${result.commerceAliasMinors}, COM pools ${result.commerceAliasPools}`,
    );
    if (result.missingCourses.length) {
      console.log(`  missing courses: ${result.missingCourses.join(', ')}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
