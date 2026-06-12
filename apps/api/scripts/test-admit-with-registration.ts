/**
 * Reproduce admit-with-registration failure.
 * Run: npx ts-node --transpile-only scripts/test-admit-with-registration.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { StudentsService } from '../src/modules/students/students.service';
import { PrismaService } from '../src/database/prisma.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const students = app.get(StudentsService);
  const prisma = app.get(PrismaService);

  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  const admin = await prisma.user.findFirst({
    where: { tenantId: tenant!.id, email: 'admin@demo.edu' },
  });
  const pv = await prisma.programVersion.findFirst({
    where: { tenantId: tenant!.id, program: { code: { contains: 'BA-ECO' } } },
  });
  const batch = await prisma.admissionBatch.findFirst({
    where: { tenantId: tenant!.id, batchCode: 'BATCH-2026' },
  });
  const stream = await prisma.academicStream.findFirst({
    where: { tenantId: tenant!.id },
  });
  const shift = await prisma.shift.findFirst({
    where: { tenantId: tenant!.id, code: 'DAY', status: 'ACTIVE' },
  });

  const sections = await prisma.offeringSection.findMany({
    where: {
      tenantId: tenant!.id,
      deletedAt: null,
      status: 'active',
      shiftId: shift!.id,
      courseOffering: {
        semesterSequence: 1,
        deletedAt: null,
        course: {
          code: {
            in: [
              'ECO-100',
              'POL-100',
              'MDC-111',
              'AEC-120',
              'AEC–123',
              'SEC-132',
              'VAC-140',
            ],
          },
        },
      },
    },
    include: { courseOffering: { include: { course: true } } },
  });

  const byCat = (cat: string, code?: string) => {
    const row = sections.find(
      (s) =>
        s.courseOffering.category === cat &&
        (!code || s.courseOffering.course.code === code),
    );
    return row?.id;
  };

  const subjectSelections: Record<string, string> = {
    MAJOR: byCat('MAJOR', 'ECO-100')!,
    MINOR: byCat('MINOR', 'POL-100')!,
    MDC: byCat('MDC', 'MDC-111')!,
    AEC: byCat('AEC', 'AEC–123') ?? byCat('AEC', 'AEC-120')!,
    SEC: byCat('SEC', 'SEC-132')!,
    VAC: byCat('VAC', 'VAC-140')!,
  };

  console.log('Sections resolved:', subjectSelections);

  const enrollment = `TEST-${Date.now().toString().slice(-6)}`;
  const email = `test.admit.${Date.now()}@demo.edu`;

  try {
    const profile = await students.admitWithRegistration(
      tenant!.id,
      admin!.id,
      {
        email,
        enrollmentNumber: enrollment,
        fullName: 'Test Admit Student',
        programVersionId: pv!.id,
        admissionBatchId: batch!.id,
        streamId: stream!.id,
        primaryShiftId: shift!.id,
        majorSubjectSlug: 'economics',
        minorSubjectSlug: 'political-science',
        subjectSelections,
        registrationAction: 'SUBMIT',
        semesterSequence: 1,
      } as never,
    );
    console.log('SUCCESS', profile.id, profile.enrollmentNumber);
  } catch (error: unknown) {
    console.error('FAILED');
    const err = error as {
      response?: { issues?: unknown[]; message?: string };
      message?: string;
    };
    console.error(err.response?.message ?? err.message);
    console.error(JSON.stringify(err.response?.issues ?? error, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
