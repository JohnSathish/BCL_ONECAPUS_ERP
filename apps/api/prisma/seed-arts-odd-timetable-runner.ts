/**
 * Populate Arts ODD timetable plan with Sem 1 / 3 / 5 demo slots.
 * Run: npx ts-node --transpile-only prisma/seed-arts-odd-timetable-runner.ts
 */
import { PrismaClient } from '@prisma/client';
import { seedArtsOddTimetable } from './seed-arts-odd-timetable';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  if (!tenant) throw new Error('Demo tenant not found');

  const institution = await prisma.institution.findFirst({
    where: { tenantId: tenant.id, deletedAt: null },
  });
  const campus = await prisma.campus.findFirst({
    where: { tenantId: tenant.id, deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });
  const academicYear = await prisma.academicYear.findFirst({
    where: { tenantId: tenant.id, deletedAt: null, name: '2026-27' },
  });
  const admin = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: 'admin@demo.edu' },
  });

  if (!institution || !campus || !academicYear) {
    throw new Error('Missing institution, campus, or academic year');
  }

  await seedArtsOddTimetable({
    prisma,
    tenantId: tenant.id,
    institutionId: institution.id,
    campusId: campus.id,
    academicYearId: academicYear.id,
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
