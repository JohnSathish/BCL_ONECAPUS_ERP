import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const tenant =
  (await prisma.tenant.findFirst({ where: { slug: 'demo' } })) ??
  (await prisma.tenant.findFirst({
    where: { name: { contains: 'Don Bosco' } },
  }));
if (!tenant) throw new Error('Tenant not found');

const commerceVersion = await prisma.programVersion.findFirst({
  where: {
    tenantId: tenant.id,
    deletedAt: null,
    status: 'PUBLISHED',
    program: { code: { startsWith: 'BCOM' } },
  },
  include: { program: true },
  orderBy: { effectiveFrom: 'desc' },
});

const morningShift = await prisma.shift.findFirst({
  where: {
    tenantId: tenant.id,
    code: { equals: 'MORNING', mode: 'insensitive' },
    status: 'ACTIVE',
    deletedAt: null,
  },
});

const commerceSubject = await prisma.academicSubject.findFirst({
  where: {
    tenantId: tenant.id,
    slug: 'commerce',
    deletedAt: null,
    isActive: true,
  },
});

const rules = commerceSubject
  ? await prisma.majorMinorRule.findMany({
      where: {
        tenantId: tenant.id,
        majorSubjectId: commerceSubject.id,
        isActive: true,
      },
      include: {
        allowedMinorSubject: { include: { department: true } },
      },
      orderBy: { allowedMinorSubject: { name: 'asc' } },
    })
  : [];

console.log('Tenant:', tenant.name);
console.log(
  'Commerce programme:',
  commerceVersion?.program.code,
  commerceVersion?.id,
);
console.log('Morning shift:', morningShift?.code, morningShift?.id);
console.log('\nDB MajorMinorRule for Commerce major:');
for (const rule of rules) {
  console.log(
    `  - ${rule.allowedMinorSubject.department?.name ?? rule.allowedMinorSubject.name} (${rule.allowedMinorSubject.slug})`,
  );
}

if (commerceVersion) {
  const minorOfferings = await prisma.courseOffering.findMany({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      semesterSequence: 5,
      category: 'MINOR',
      OR: [
        { programVersionId: commerceVersion.id },
        {
          categoryPool: {
            assignments: {
              some: {
                programVersionId: commerceVersion.id,
                active: true,
              },
            },
          },
        },
      ],
    },
    include: {
      course: { select: { code: true, title: true, departmentId: true } },
      categoryPool: true,
    },
    orderBy: { course: { code: 'asc' } },
  });
  console.log('\nSem5 MINOR offerings linked to BCOM programme:');
  for (const offering of minorOfferings) {
    console.log(`  - ${offering.course.code} | ${offering.course.title}`);
  }

  const ecoMinor = await prisma.courseOffering.findMany({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      semesterSequence: 5,
      category: 'MINOR',
      course: { code: { startsWith: 'ECO-302' } },
    },
    include: {
      course: { select: { code: true, title: true } },
      programVersion: { include: { program: true } },
      categoryPool: {
        include: {
          assignments: {
            where: { active: true },
            include: { programVersion: { include: { program: true } } },
          },
        },
      },
    },
  });
  console.log('\nECO-302 Sem5 minor offerings in system:');
  for (const offering of ecoMinor) {
    const programs = offering.programVersion?.program?.code
      ? [offering.programVersion.program.code]
      : (offering.categoryPool?.assignments.map(
          (a) => a.programVersion.program.code,
        ) ?? []);
    console.log(
      `  - ${offering.course.code} | programs: ${programs.join(', ') || 'none'}`,
    );
  }
}

if (morningShift) {
  const configs = await prisma.shiftDepartmentConfig.findMany({
    where: {
      tenantId: tenant.id,
      shiftId: morningShift.id,
      enabled: true,
    },
    include: { department: true },
    orderBy: { department: { name: 'asc' } },
  });
  console.log('\nMorning shift enabled departments:');
  for (const config of configs) {
    console.log(`  - ${config.department.code} ${config.department.name}`);
  }
}

await prisma.$disconnect();
