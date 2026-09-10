/**
 * Load St. Luke's official bell times (handbook TIME TABLE, empty class grid).
 * Does not invent subject/teacher slots.
 *
 *   npx tsx scripts/import-st-lukes-timetable.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BELLS: Array<{
  kind: 'PERIOD' | 'BREAK';
  code: string;
  label: string;
  startTime: string;
  endTime: string;
  sortOrder: number;
  periodNumber: number | null;
}> = [
  {
    kind: 'PERIOD',
    code: 'P1',
    label: '1st Period',
    startTime: '09:00',
    endTime: '09:55',
    sortOrder: 1,
    periodNumber: 1,
  },
  {
    kind: 'PERIOD',
    code: 'P2',
    label: '2nd Period',
    startTime: '09:55',
    endTime: '10:35',
    sortOrder: 2,
    periodNumber: 2,
  },
  {
    kind: 'BREAK',
    code: 'R1',
    label: '15 Minutes Recess',
    startTime: '10:35',
    endTime: '10:50',
    sortOrder: 3,
    periodNumber: null,
  },
  {
    kind: 'PERIOD',
    code: 'P3',
    label: '3rd Period',
    startTime: '10:50',
    endTime: '11:30',
    sortOrder: 4,
    periodNumber: 3,
  },
  {
    kind: 'PERIOD',
    code: 'P4',
    label: '4th Period',
    startTime: '11:30',
    endTime: '12:10',
    sortOrder: 5,
    periodNumber: 4,
  },
  {
    kind: 'BREAK',
    code: 'R2',
    label: '30 Minutes Recess',
    startTime: '12:10',
    endTime: '12:40',
    sortOrder: 6,
    periodNumber: null,
  },
  {
    kind: 'PERIOD',
    code: 'P5',
    label: '5th Period',
    startTime: '12:40',
    endTime: '13:20',
    sortOrder: 7,
    periodNumber: 5,
  },
  {
    kind: 'PERIOD',
    code: 'P6',
    label: '6th Period',
    startTime: '13:20',
    endTime: '13:55',
    sortOrder: 8,
    periodNumber: 6,
  },
  {
    kind: 'PERIOD',
    code: 'P7',
    label: '7th Period',
    startTime: '13:55',
    endTime: '14:30',
    sortOrder: 9,
    periodNumber: 7,
  },
];

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'st-lukes-tura', deletedAt: null },
  });
  if (!tenant) throw new Error('st-lukes-tura tenant not found');
  const year = await prisma.schoolAcademicYear.findFirst({
    where: { tenantId: tenant.id, deletedAt: null, status: 'CURRENT' },
  });
  if (!year) throw new Error('No CURRENT school academic year');

  for (const bell of BELLS) {
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
        daysJson: [1, 2, 3, 4, 5, 6],
      },
    });
    console.log('Created draft timetable plan');
  } else {
    console.log(`Plan already exists: ${existing.name} (${existing.status})`);
  }
  console.log(`Upserted ${BELLS.length} bells for ${year.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
