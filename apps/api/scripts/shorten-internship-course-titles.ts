/**
 * Rename verbose Sem-5 internship course titles to "Internship" for all departments.
 *
 * Usage (from apps/api):
 *   npx tsx scripts/shorten-internship-course-titles.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const LONG_TITLES = [
  'Internship / Apprenticeship / Community Engagement and Service / Field Based Learning or Minor Project',
  'Internship / Apprenticeship / Community Engagement and Service',
];

async function main() {
  const result = await prisma.course.updateMany({
    where: {
      title: { in: LONG_TITLES },
      deletedAt: null,
    },
    data: { title: 'Internship' },
  });
  console.log(`Updated ${result.count} course title(s) to "Internship".`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
