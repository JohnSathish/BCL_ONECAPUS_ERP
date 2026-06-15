import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  await prisma.$executeRawUnsafe(`
    ALTER TABLE academic.staff_profiles
    ADD COLUMN IF NOT EXISTS teaching_shift_category TEXT NOT NULL DEFAULT 'DAY'
  `);
  console.log('teaching_shift_category column ready');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
