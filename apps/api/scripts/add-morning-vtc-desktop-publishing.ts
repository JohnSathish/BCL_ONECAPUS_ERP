/**
 * Add Desktop Publishing and Computerized Accounting to Morning Sem 3 VTC pool.
 *
 * Morning shift programmes use a shift-specific pool that currently omits
 * VTC: 243.2 / VTC: 243.3 even though students are enrolled in those papers.
 *
 *   npx ts-node --transpile-only scripts/add-morning-vtc-desktop-publishing.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

const MISSING_CODES = ['VTC: 243.2', 'VTC: 243.3'] as const;

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const prisma = app.get(PrismaService);

  try {
    const tenant =
      (await prisma.tenant.findFirst({ where: { slug: 'demo' } })) ??
      (await prisma.tenant.findFirst({
        where: { name: { contains: 'Don Bosco' } },
      }));
    if (!tenant) throw new Error('Tenant not found');

    const morning = await prisma.shift.findFirst({
      where: { tenantId: tenant.id, code: 'MORNING', deletedAt: null },
    });
    if (!morning) throw new Error('MORNING shift not found');

    const morningPool = await prisma.categoryPool.findFirst({
      where: {
        tenantId: tenant.id,
        active: true,
        categoryType: 'VTC',
        semesterNo: 3,
        shiftId: morning.id,
      },
    });
    if (!morningPool) throw new Error('Morning Shift Sem 3 VTC pool not found');

    const globalPool = await prisma.categoryPool.findFirst({
      where: {
        tenantId: tenant.id,
        active: true,
        categoryType: 'VTC',
        semesterNo: 3,
        shiftId: null,
      },
      include: {
        offerings: {
          where: {
            deletedAt: null,
            course: { code: { in: [...MISSING_CODES] } },
          },
          include: {
            course: true,
            sections: {
              where: { deletedAt: null, shiftId: morning.id },
            },
          },
        },
      },
    });
    if (!globalPool) throw new Error('Global VTC Semester 3 pool not found');

    const template = await prisma.courseOffering.findFirst({
      where: {
        tenantId: tenant.id,
        categoryPoolId: morningPool.id,
        deletedAt: null,
      },
      include: {
        sections: {
          where: { deletedAt: null, shiftId: morning.id },
          take: 1,
        },
      },
    });
    if (!template) {
      throw new Error('No template offering in Morning VTC pool');
    }

    for (const source of globalPool.offerings) {
      const existing = await prisma.courseOffering.findFirst({
        where: {
          tenantId: tenant.id,
          categoryPoolId: morningPool.id,
          courseId: source.courseId,
          deletedAt: null,
        },
      });
      if (existing) {
        console.log(
          `Already in Morning pool: ${source.course.code} | ${source.course.title}`,
        );
        continue;
      }

      const offering = await prisma.courseOffering.create({
        data: {
          tenantId: tenant.id,
          courseId: source.courseId,
          categoryPoolId: morningPool.id,
          category: 'VTC',
          semesterSequence: 3,
          mappingSource: 'SHARED_POOL',
          displayOrder: source.displayOrder ?? template.displayOrder,
          capacity: source.capacity ?? template.capacity,
          waitlistCapacity:
            source.waitlistCapacity ?? template.waitlistCapacity,
        },
      });

      const sectionTemplate = template.sections[0];
      if (sectionTemplate) {
        await prisma.offeringSection.create({
          data: {
            tenantId: tenant.id,
            courseOfferingId: offering.id,
            shiftId: morning.id,
            sectionCode: sectionTemplate.sectionCode,
            status: sectionTemplate.status,
            capacity: sectionTemplate.capacity,
            waitlistCapacity: sectionTemplate.waitlistCapacity,
          },
        });
      }

      console.log(
        `Added to Morning pool: ${source.course.code} | ${source.course.title}`,
      );
    }

    const offerings = await prisma.courseOffering.findMany({
      where: {
        tenantId: tenant.id,
        categoryPoolId: morningPool.id,
        deletedAt: null,
      },
      include: { course: { select: { code: true, title: true } } },
      orderBy: { course: { code: 'asc' } },
    });
    console.log('\nMorning Sem 3 VTC pool now:');
    for (const offering of offerings) {
      console.log(`  ${offering.course.code} | ${offering.course.title}`);
    }
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
