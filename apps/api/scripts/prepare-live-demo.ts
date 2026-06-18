/**
 * One-shot live demo preparation: seed data, fees, LMS, smoke tests.
 *
 *   npx ts-node --transpile-only scripts/prepare-live-demo.ts
 *   npx ts-node --transpile-only scripts/prepare-live-demo.ts --skip-tests
 */
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'node:child_process';
import { AppModule } from '../src/app.module';
import type { JwtUser } from '../src/common/decorators/current-user.decorator';
import { MonthlyFeeEngineService } from '../src/modules/fees/services/monthly-fee-engine.service';
import { LmsWorkspaceService } from '../src/modules/lms/services/lms-workspace.service';
import { LmsSettingsService } from '../src/modules/lms/services/lms-settings.service';
import { seedDemoLiveReady } from '../prisma/seed-demo-live-ready';

const prisma = new PrismaClient();

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

const skipTests = process.argv.includes('--skip-tests');
const tenantSlug = readArg('tenant') ?? 'demo';

async function loadContext() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: tenantSlug } });
  if (!tenant) throw new Error(`Tenant not found: ${tenantSlug}`);

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

  return {
    tenant,
    admin,
    ctx: {
      prisma,
      tenantId: tenant.id,
      institutionId: institution.id,
      campusId: campus.id,
      academicYearId: academicYear.id,
      createdById: admin?.id,
      shifts: shiftMap,
      semesterBySeq,
    },
  };
}

async function runVerify(script: string, label: string) {
  console.log(`\n>> ${label}`);
  execSync(`npx ts-node --transpile-only scripts/${script}`, {
    cwd: process.cwd(),
    stdio: 'inherit',
  });
}

async function main() {
  const { tenant, admin, ctx } = await loadContext();

  console.log(`Preparing live demo for tenant: ${tenantSlug}`);
  await seedDemoLiveReady(ctx);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const settings = app.get(LmsSettingsService);
    const workspaces = app.get(LmsWorkspaceService);
    await settings.getOrCreate(tenant.id);
    const lms = await workspaces.provisionAllForTenant(tenant.id);
    console.log('LMS workspaces:', lms);

    const monthly = app.get(MonthlyFeeEngineService);
    const fees = await monthly.generateBulk(tenant.id, undefined, admin?.id);
    console.log('Monthly fee demands:', {
      created: fees.created,
      skipped: fees.skipped,
      billingPeriod: fees.billingPeriod,
    });

    const demandCount = await (prisma as any).studentFeeDemand.count({
      where: { tenantId: tenant.id, status: { in: ['PUBLISHED', 'DRAFT'] } },
    });
    console.log(`Total fee demands in DB: ${demandCount}`);
  } finally {
    await app.close();
  }

  if (!skipTests) {
    runVerify('verify-subject-group-attendance.ts', 'Timetable + attendance');
    runVerify('verify-student-portal.ts', 'Student portal');
    runVerify('verify-naac-iqac.ts', 'NAAC IQAC');
    runVerify('verify-governance-import.ts', 'Governance');
  }

  console.log('\n✓ Live demo preparation complete');
  console.log('  Admin: demo / admin@demo.edu / Admin@123');
  console.log('  Faculty: francis.momin@demo.edu / Faculty@123');
  console.log('  Student: demo.student.001@demo.edu / Student@123');
}

main()
  .catch((error) => {
    console.error('Live demo preparation failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
