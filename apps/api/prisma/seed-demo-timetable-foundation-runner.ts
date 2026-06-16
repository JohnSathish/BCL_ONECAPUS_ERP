/**
 * Apply demo faculty, classrooms, registrations, and publish timetable plans.
 * Run: npx ts-node --transpile-only prisma/seed-demo-timetable-foundation-runner.ts
 */
import { PrismaClient } from '@prisma/client';
import { seedDemoTimetableFoundation } from './seed-demo-timetable-foundation';

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
  const shifts = await prisma.shift.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
  });
  const shiftMap = Object.fromEntries(
    shifts.map((shift) => [shift.code, { id: shift.id }]),
  ) as Record<string, { id: string }>;

  const semesters = await prisma.semester.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
  });
  const semesterBySeq = Object.fromEntries(
    semesters.map((sem) => [sem.sequence, { id: sem.id }]),
  ) as Record<number, { id: string }>;

  if (!institution || !campus || !academicYear) {
    throw new Error('Missing institution, campus, or academic year');
  }

  const result = await seedDemoTimetableFoundation({
    prisma,
    tenantId: tenant.id,
    institutionId: institution.id,
    campusId: campus.id,
    academicYearId: academicYear.id,
    createdById: admin?.id,
    shifts: shiftMap,
    semesterBySeq,
  });
  console.log('Done:', result);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
