import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import type { JwtUser } from '../src/common/decorators/current-user.decorator';
import { PrismaService } from '../src/database/prisma.service';
import { LoansManagementService } from '../src/modules/loans/services/loans-management.service';
import { LoansSetupService } from '../src/modules/loans/services/loans-setup.service';
import {
  buildStaffLookup,
  EXCLUDED_SALARY_NAMES,
  loadLegacyTeachingRows,
  matchStaffToSheetRow,
  normalizeName,
} from './lib/salary-xlsx-parse';

/**
 * Creates or updates active salary-deduction loans from the legacy teaching salary sheet
 * loan column (monthly deduction amount). Outstanding balance is estimated as
 * deduction × 24 months unless an existing loan balance is higher.
 */
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error'],
  });
  const prisma = app.get(PrismaService);
  const loans = app.get(LoansManagementService);
  const setup = app.get(LoansSetupService);

  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  if (!tenant) throw new Error('demo tenant not found');

  const admin = await prisma.user.findFirst({
    where: { tenantId: tenant.id, isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!admin) throw new Error('admin user not found');

  const user: JwtUser = {
    sub: admin.id,
    tid: tenant.id,
    email: admin.email,
    roles: [],
  };

  await setup.ensureTenant(tenant.id);

  const welfareType = await prisma.loanTypeConfig.findFirst({
    where: { tenantId: tenant.id, code: 'WELFARE' },
  });

  const sheetRows = await loadLegacyTeachingRows();
  const staff = await prisma.staffProfile.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
    select: { id: true, employeeCode: true, fullName: true },
  });
  const lookup = buildStaffLookup(staff);

  let skipped = 0;
  let noLoan = 0;
  let created = 0;
  let updated = 0;
  let unmatched = 0;

  const today = new Date().toISOString().slice(0, 10);

  for (const row of sheetRows) {
    if (EXCLUDED_SALARY_NAMES.has(normalizeName(row.name))) {
      skipped += 1;
      continue;
    }
    if (row.loan <= 0) {
      noLoan += 1;
      continue;
    }

    const matched = matchStaffToSheetRow(row, lookup, staff);
    if (!matched) {
      unmatched += 1;
      console.warn(`Unmatched: ${row.name} (loan ₹${row.loan})`);
      continue;
    }

    const monthlyDeduction = row.loan;
    const estimatedPrincipal = monthlyDeduction * 24;

    const existing = await prisma.staffLoan.findFirst({
      where: {
        tenantId: tenant.id,
        staffProfileId: matched.staff.id,
        status: { in: ['ACTIVE', 'PAUSED'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      const balance = Number(existing.balanceAmount);
      const needsBalanceBump = balance < monthlyDeduction;
      await prisma.staffLoan.update({
        where: { id: existing.id },
        data: {
          monthlyDeduction,
          salaryDeductionAmount: monthlyDeduction,
          ...(needsBalanceBump
            ? {
                balanceAmount: Math.max(balance, estimatedPrincipal),
                principalAmount: Math.max(
                  Number(existing.principalAmount),
                  estimatedPrincipal,
                ),
              }
            : {}),
        },
      });
      updated += 1;
      console.log(
        `Updated ${matched.staff.fullName}: ₹${monthlyDeduction}/mo (bal ₹${balance})`,
      );
      continue;
    }

    await loans.create(user, {
      staffProfileId: matched.staff.id,
      loanTypeConfigId: welfareType?.id,
      loanType: welfareType?.name ?? 'Staff Welfare Loan',
      principalAmount: estimatedPrincipal,
      repaymentMethod: 'SALARY_DEDUCTION',
      salaryDeductionAmount: monthlyDeduction,
      monthlyInstallment: monthlyDeduction,
      loanDate: today,
      repaymentStartDate: today,
      notes: `Imported from salary sheet row ${row.rowNumber} (${matched.method})`,
    });
    created += 1;
    console.log(
      `Created ${matched.staff.fullName}: ₹${monthlyDeduction}/mo, est. principal ₹${estimatedPrincipal}`,
    );
  }

  console.log('\n--- Summary ---');
  console.log({ skipped, noLoan, unmatched, created, updated });
  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
