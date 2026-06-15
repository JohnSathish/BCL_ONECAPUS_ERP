/**
 * Create and calculate May 2026 STATE payroll run.
 * Run: npx ts-node --transpile-only scripts/create-may-2026-state-payroll-run.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import type { JwtUser } from '../src/common/decorators/current-user.decorator';
import { PrismaService } from '../src/database/prisma.service';
import { PayrollRunEngineService } from '../src/modules/payroll/services/payroll-run-engine.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error'],
  });
  const prisma = app.get(PrismaService);
  const runs = app.get(PayrollRunEngineService);

  const tenant =
    (await prisma.tenant.findFirst({
      where: { name: { contains: 'Don Bosco' } },
    })) ?? (await prisma.tenant.findFirst({ where: { slug: 'demo' } }));
  if (!tenant) throw new Error('Tenant not found');

  const admin = await prisma.user.findFirst({
    where: { tenantId: tenant.id, isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!admin) throw new Error('Admin user not found');

  const user: JwtUser = {
    sub: admin.id,
    tid: tenant.id,
    email: admin.email,
    roles: [],
    permissions: [],
  };

  let run = await prisma.payrollRun.findFirst({
    where: { tenantId: tenant.id, month: 5, year: 2026, payScaleType: 'STATE' },
  });

  if (!run) {
    run = await runs.create(user, {
      month: 5,
      year: 2026,
      payScaleType: 'STATE',
      label: 'May 2026 - STATE - DRAFT',
    });
    console.log('Created payroll run:', run.id, run.label);
  } else {
    console.log('Using existing payroll run:', run.id, run.label, run.status);
  }

  const calculated = await runs.calculate(user, run.id);
  const detail = await runs.getRun(tenant.id, run.id);

  console.log('\nPayroll run calculated:');
  console.log({
    id: calculated.id,
    label: calculated.label,
    status: calculated.status,
    employeeCount: calculated.employeeCount,
    totalGross: Number(calculated.totalGross),
    totalDeductions: Number(calculated.totalDeductions),
    totalNet: Number(calculated.totalNet),
    payslips: detail.payslips.length,
  });

  for (const ps of detail.payslips.slice(0, 3)) {
    console.log(
      `  ${ps.staffProfile?.employeeCode} | ${ps.staffProfile?.fullName} | gross=${Number(ps.grossSalary)} net=${Number(ps.netSalary)}`,
    );
  }
  if (detail.payslips.length > 3) {
    console.log(`  ... and ${detail.payslips.length - 3} more`);
  }

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
