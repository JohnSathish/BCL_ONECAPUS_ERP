/**
 * Load St. Luke's official bell times (handbook TIME TABLE, empty class grid).
 * Does not invent subject/teacher slots.
 *
 *   npx tsx scripts/import-st-lukes-timetable.ts
 */
import { PrismaClient } from '@prisma/client';
import { ST_LUKES_BELLS } from '../src/modules/school-sis/school-sis-timetable-bells';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'st-lukes-tura', deletedAt: null },
  });
  if (!tenant) throw new Error('st-lukes-tura tenant not found');
  const year = await prisma.schoolAcademicYear.findFirst({
    where: { tenantId: tenant.id, deletedAt: null, status: 'CURRENT' },
  });
  if (!year) throw new Error('No CURRENT school academic year');

  for (const bell of ST_LUKES_BELLS) {
    await prisma.schoolTimetableBell.upsert({
      where: {
        tenantId_academicYearId_code: {
          tenantId: tenant.id,
          academicYearId: year.id,
          code: bell.code,
        },
      },
      update: {
        kind: bell.kind,
        label: bell.label,
        startTime: bell.startTime,
        endTime: bell.endTime,
        sortOrder: bell.sortOrder,
        periodNumber: bell.periodNumber,
      },
      create: {
        tenantId: tenant.id,
        academicYearId: year.id,
        ...bell,
      },
    });
  }

  const existing = await prisma.schoolTimetablePlan.findFirst({
    where: { tenantId: tenant.id, academicYearId: year.id },
    orderBy: { createdAt: 'asc' },
  });
  if (!existing) {
    await prisma.schoolTimetablePlan.create({
      data: {
        tenantId: tenant.id,
        academicYearId: year.id,
        name: `${year.name} timetable`,
        status: 'DRAFT',
        daysJson: [1, 2, 3, 4, 5],
      },
    });
    console.log('Created draft timetable plan');
  } else {
    console.log(`Plan already exists: ${existing.name} (${existing.status})`);
  }
  console.log(`Upserted ${ST_LUKES_BELLS.length} bells for ${year.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
