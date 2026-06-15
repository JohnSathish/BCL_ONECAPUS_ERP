/**
 * Fix wrongly assigned shifts from first morning import pass.
 * Run: npx ts-node --transpile-only scripts/fix-morning-shift-mismatches.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { StaffEmploymentService } from '../src/modules/staff/services/staff-employment.service';

const REVERT_TO_DAY = [
  'DBCTCH-15-001', // TENANG R. MARAK — not on morning list
  'DBCTCH-25-008', // Isaac Kadim — not on morning list
  'DBCTCH-19-002', // Ferick Salnang — not on morning list
];

const SET_MORNING = ['DBCTCH-24-003']; // Ambalika M Marak

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error'],
  });
  const prisma = app.get(PrismaService);
  const employment = app.get(StaffEmploymentService);
  const tenant = await prisma.tenant.findFirst({
    where: { name: { contains: 'Don Bosco' } },
  });
  if (!tenant) throw new Error('Tenant not found');

  for (const code of REVERT_TO_DAY) {
    const staff = await prisma.staffProfile.findFirst({
      where: { tenantId: tenant.id, employeeCode: code, deletedAt: null },
    });
    if (!staff) continue;
    await employment.applyEmploymentUpdate(tenant.id, staff.id, {
      teachingShiftCategory: 'DAY',
    });
    console.log(`REVERTED ${code} → DAY`);
  }

  for (const code of SET_MORNING) {
    const staff = await prisma.staffProfile.findFirst({
      where: { tenantId: tenant.id, employeeCode: code, deletedAt: null },
    });
    if (!staff) continue;
    await employment.applyTeachingShiftCategory(tenant.id, staff.id, 'MORNING');
    console.log(`SET MORNING ${code}`);
  }

  await app.close();
}

main();
