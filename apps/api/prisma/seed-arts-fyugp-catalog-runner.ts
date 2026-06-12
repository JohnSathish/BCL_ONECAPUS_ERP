/**
 * Standalone runner: seed Arts FYUGP ODD (sem 1/3/5) course catalog for demo tenant.
 * Run: npx ts-node --transpile-only prisma/seed-arts-fyugp-catalog-runner.ts
 */
import { PrismaClient } from '@prisma/client';
import { seedArtsFyugpCatalog } from './seed-arts-fyugp-catalog';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  if (!tenant) throw new Error('Demo tenant not found');

  const institution = await prisma.institution.findFirst({
    where: { tenantId: tenant.id, deletedAt: null },
  });
  if (!institution) throw new Error('Institution not found');

  const semesters = await prisma.semester.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
    orderBy: { sequence: 'asc' },
  });
  const semesterBySeq = Object.fromEntries(
    semesters.map((sem) => [sem.sequence, { id: sem.id }]),
  ) as Record<number, { id: string }>;

  const campus = await prisma.campus.findFirst({
    where: { tenantId: tenant.id, deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });
  if (!campus) throw new Error('Campus not found');

  const dayShift = await prisma.shift.findFirst({
    where: {
      tenantId: tenant.id,
      campusId: campus.id,
      code: 'DAY',
      deletedAt: null,
    },
  });
  if (!dayShift) throw new Error('Day shift not found');

  const admin = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: 'admin@demo.edu' },
  });

  await seedArtsFyugpCatalog({
    prisma,
    tenantId: tenant.id,
    institutionId: institution.id,
    semesterBySeq,
    shifts: { DAY: dayShift },
    createdById: admin?.id,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
