import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const program = await prisma.program.findFirst({
    where: { code: 'ECO-100' },
    include: {
      versions: { where: { deletedAt: null } },
    },
  });
  console.log('ECO-100 program:', program);

  if (program) {
    for (const v of program.versions) {
      const usage = {
        offerings: await prisma.courseOffering.count({
          where: { programVersionId: v.id, deletedAt: null },
        }),
        students: await prisma.student.count({
          where: { programVersionId: v.id, deletedAt: null },
        }),
      };
      console.log(`  v${v.version} (${v.status}):`, usage);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
