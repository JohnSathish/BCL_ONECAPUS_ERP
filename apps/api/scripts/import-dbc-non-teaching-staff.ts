/**
 * Import / resync DBC non-teaching staff from the May 2026 salary sheet.
 * Run: npx ts-node --transpile-only scripts/import-dbc-non-teaching-staff.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import type { JwtUser } from '../src/common/decorators/current-user.decorator';
import { PrismaService } from '../src/database/prisma.service';
import { LoansManagementService } from '../src/modules/loans/services/loans-management.service';
import { LoansSetupService } from '../src/modules/loans/services/loans-setup.service';
import { DbcPayrollSetupService } from '../src/modules/payroll/services/dbc-payroll-setup.service';
import { PayrollRunEngineService } from '../src/modules/payroll/services/payroll-run-engine.service';
import { StaffPayAssignmentService } from '../src/modules/payroll/services/staff-pay-assignment.service';
import { StaffPfConfigService } from '../src/modules/payroll/services/staff-pf-config.service';
import { StaffProvisioningService } from '../src/modules/staff/services/staff-provisioning.service';

type NonTeachingSeed = {
  fullName: string;
  basicPay: number;
  fixedAllowance: number;
  pfEnrolled: boolean;
  houseRent?: number;
  monthlyLoan?: number;
};

/** May 2026 non-teaching salary sheet — Don Bosco College, Tura */
const NON_TEACHING_STAFF: NonTeachingSeed[] = [
  {
    fullName: 'BARCELONA CH MOMIN',
    basicPay: 22800,
    fixedAllowance: 7500,
    pfEnrolled: true,
  },
  {
    fullName: 'JEVILLINE A SANGMA',
    basicPay: 22800,
    fixedAllowance: 3500,
    pfEnrolled: true,
  },
  {
    fullName: 'NELESH ROY',
    basicPay: 19100,
    fixedAllowance: 8500,
    pfEnrolled: true,
    houseRent: 500,
    monthlyLoan: 15000,
  },
  {
    fullName: 'JOHN SATHISH S',
    basicPay: 18600,
    fixedAllowance: 20200,
    pfEnrolled: true,
  },
  {
    fullName: 'SUDESH BASFOR',
    basicPay: 15750,
    fixedAllowance: 500,
    pfEnrolled: true,
    houseRent: 500,
    monthlyLoan: 10000,
  },
  {
    fullName: 'FRANCIS T SANGMA',
    basicPay: 13500,
    fixedAllowance: 700,
    pfEnrolled: true,
    monthlyLoan: 5000,
  },
  {
    fullName: 'SUNIL R MARAK',
    basicPay: 13250,
    fixedAllowance: 1400,
    pfEnrolled: true,
    houseRent: 500,
    monthlyLoan: 4500,
  },
  {
    fullName: 'BAIRING N SANGMA',
    basicPay: 12250,
    fixedAllowance: 1000,
    pfEnrolled: true,
    houseRent: 500,
  },
  {
    fullName: 'JUSTA M SANGMA',
    basicPay: 12250,
    fixedAllowance: 1000,
    pfEnrolled: true,
    monthlyLoan: 5000,
  },
  {
    fullName: 'CONSTANTINE RANI',
    basicPay: 11500,
    fixedAllowance: 3200,
    pfEnrolled: true,
  },
  {
    fullName: 'THREENA A MARAK',
    basicPay: 15700,
    fixedAllowance: 5000,
    pfEnrolled: true,
  },
  {
    fullName: 'RINGRANG M SANGMA',
    basicPay: 15700,
    fixedAllowance: 5000,
    pfEnrolled: true,
    monthlyLoan: 4000,
  },
  {
    fullName: 'HILARIUS CH SANGMA',
    basicPay: 25000,
    fixedAllowance: 0,
    pfEnrolled: false,
  },
  {
    fullName: 'SALBARIN R MARAK',
    basicPay: 15000,
    fixedAllowance: 5000,
    pfEnrolled: false,
    monthlyLoan: 5000,
  },
  {
    fullName: 'MONALISA TIRKEY',
    basicPay: 10250,
    fixedAllowance: 2000,
    pfEnrolled: false,
    houseRent: 800,
  },
  {
    fullName: 'GALCHI A SANGMA',
    basicPay: 7500,
    fixedAllowance: 2000,
    pfEnrolled: false,
    monthlyLoan: 5000,
  },
  {
    fullName: 'TOMALI D SAGMA',
    basicPay: 7500,
    fixedAllowance: 2000,
    pfEnrolled: false,
    monthlyLoan: 5000,
  },
  {
    fullName: 'NITTEPULLIAR CH MOMI',
    basicPay: 10000,
    fixedAllowance: 0,
    pfEnrolled: false,
  },
];

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toUpperCase();
}

function emailSlug(fullName: string): string {
  return fullName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '.');
}

function expectedGross(row: NonTeachingSeed): number {
  const pfEarning = row.pfEnrolled ? 600 : 0;
  return row.basicPay + row.fixedAllowance + pfEarning;
}

function expectedNet(row: NonTeachingSeed): number {
  const pf = row.pfEnrolled ? 1200 : 0;
  return (
    expectedGross(row) - pf - (row.houseRent ?? 0) - (row.monthlyLoan ?? 0)
  );
}

async function resolveTenant(prisma: PrismaService) {
  return (
    (await prisma.tenant.findFirst({
      where: { name: { contains: 'Don Bosco' } },
    })) ?? (await prisma.tenant.findFirst({ where: { slug: 'demo' } }))
  );
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error'],
  });
  const prisma = app.get(PrismaService);
  const staffProvisioning = app.get(StaffProvisioningService);
  const payAssignments = app.get(StaffPayAssignmentService);
  const payrollSetup = app.get(DbcPayrollSetupService);
  const pfConfig = app.get(StaffPfConfigService);
  const loans = app.get(LoansManagementService);
  const loansSetup = app.get(LoansSetupService);
  const payrollRuns = app.get(PayrollRunEngineService);

  const tenant = await resolveTenant(prisma);
  if (!tenant) throw new Error('Tenant not found (Don Bosco / demo)');

  const admin = await prisma.user.findFirst({
    where: { tenantId: tenant.id, isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!admin) throw new Error('Active admin user not found');

  const user: JwtUser = {
    sub: admin.id,
    tid: tenant.id,
    email: admin.email,
    roles: [],
    permissions: [],
  };

  await payrollSetup.ensureTenant(tenant.id);
  await loansSetup.ensureTenant(tenant.id);

  const payStructure = await prisma.payStructureTemplate.findFirst({
    where: { tenantId: tenant.id, code: 'DBC_NON_TEACHING', status: 'ACTIVE' },
  });
  if (!payStructure)
    throw new Error('DBC_NON_TEACHING pay structure not found');

  const welfareType = await prisma.loanTypeConfig.findFirst({
    where: { tenantId: tenant.id, code: 'WELFARE' },
  });

  const existing = await prisma.staffProfile.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
    select: { id: true, fullName: true, employeeCode: true, staffType: true },
  });
  const byName = new Map(
    existing.map((row) => [normalizeName(row.fullName), row]),
  );

  let created = 0;
  let assignments = 0;
  let loansSynced = 0;

  for (const row of NON_TEACHING_STAFF) {
    const key = normalizeName(row.fullName);
    const match = byName.get(key);

    let staffId = match?.id;
    let employeeCode = match?.employeeCode;

    if (!staffId) {
      const email = `${emailSlug(row.fullName)}@dbc-staff.placeholder`;
      const { staff: profile } = await staffProvisioning.create(
        tenant.id,
        {
          fullName: row.fullName,
          email,
          staffType: 'NON_TEACHING',
          employmentType: 'PERMANENT',
          joiningDate: '2026-05-01',
          createPortalAccount: false,
          employeeCodeAutoGenerated: true,
        },
        admin.id,
      );
      staffId = profile.id;
      employeeCode = profile.employeeCode;
      byName.set(key, {
        id: profile.id,
        fullName: profile.fullName,
        employeeCode: profile.employeeCode,
        staffType: profile.staffType,
      });
      created++;
      console.log(`CREATED ${employeeCode} | ${row.fullName}`);
    } else if (match!.staffType !== 'NON_TEACHING') {
      await prisma.staffProfile.update({
        where: { id: staffId },
        data: { staffType: 'NON_TEACHING', basicPay: row.basicPay },
      });
      console.log(
        `UPDATED type → NON_TEACHING: ${employeeCode} | ${row.fullName}`,
      );
    } else {
      await prisma.staffProfile.update({
        where: { id: staffId },
        data: { basicPay: row.basicPay },
      });
      console.log(`SYNC ${employeeCode} | ${row.fullName}`);
    }

    await payAssignments.create(user, {
      staffProfileId: staffId,
      payStructureTemplateId: payStructure.id,
      payScaleType: 'COLLEGE_NON_TEACHING',
      basicPay: row.basicPay,
      fixedAllowance: row.fixedAllowance,
      houseRent: row.houseRent ?? 0,
      pfExempt: !row.pfEnrolled,
      effectiveFrom: '2026-05-01',
      notes: 'Resynced from May 2026 non-teaching salary sheet',
    });
    assignments++;

    await pfConfig.upsert(user, staffId, {
      pfEnabled: row.pfEnrolled,
      employeePfApplicable: row.pfEnrolled,
      employerPfApplicable: row.pfEnrolled,
      pfScheme: row.pfEnrolled ? 'PF_FIXED_AMOUNT' : 'NOT_APPLICABLE',
      employerPfAmount: row.pfEnrolled ? 600 : null,
      employeePfAmount: row.pfEnrolled ? 1200 : null,
      effectiveFrom: '2026-05-01',
      remarks: 'May 2026 non-teaching salary sheet',
    });

    const activeLoan = await prisma.staffLoan.findFirst({
      where: {
        tenantId: tenant.id,
        staffProfileId: staffId,
        status: { in: ['ACTIVE', 'PAUSED'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (row.monthlyLoan && row.monthlyLoan > 0) {
      const estimatedPrincipal = row.monthlyLoan * 24;
      if (activeLoan) {
        await prisma.staffLoan.update({
          where: { id: activeLoan.id },
          data: {
            monthlyDeduction: row.monthlyLoan,
            salaryDeductionAmount: row.monthlyLoan,
            balanceAmount: Math.max(
              Number(activeLoan.balanceAmount),
              estimatedPrincipal,
            ),
            principalAmount: Math.max(
              Number(activeLoan.principalAmount),
              estimatedPrincipal,
            ),
          },
        });
      } else {
        await loans.create(user, {
          staffProfileId: staffId,
          loanTypeConfigId: welfareType?.id,
          loanType: welfareType?.name ?? 'Staff Welfare Loan',
          principalAmount: estimatedPrincipal,
          monthlyInstallment: row.monthlyLoan,
          salaryDeductionAmount: row.monthlyLoan,
          repaymentMethod: 'SALARY_DEDUCTION',
          loanDate: '2026-05-01',
          repaymentStartDate: '2026-05-01',
          notes: 'Imported from May 2026 non-teaching salary sheet',
        });
      }
      loansSynced++;
    } else if (activeLoan) {
      await prisma.staffLoan.update({
        where: { id: activeLoan.id },
        data: {
          monthlyDeduction: 0,
          salaryDeductionAmount: 0,
          status: 'CLOSED',
          balanceAmount: 0,
        },
      });
    }

    console.log(
      `  basic=${row.basicPay} allowance=${row.fixedAllowance} gross=${expectedGross(row)} net=${expectedNet(row)}`,
    );
  }

  let run = await prisma.payrollRun.findFirst({
    where: {
      tenantId: tenant.id,
      month: 5,
      year: 2026,
      payScaleType: 'COLLEGE_NON_TEACHING',
    },
  });
  if (!run) {
    run = await payrollRuns.create(user, {
      month: 5,
      year: 2026,
      payScaleType: 'COLLEGE_NON_TEACHING',
      label: 'May 2026 - COLLEGE_NON_TEACHING - DRAFT',
    });
  }

  const calculated = await payrollRuns.calculate(user, run.id);
  const detail = await payrollRuns.getRun(tenant.id, run.id);

  console.log('\n=== IMPORT SUMMARY ===');
  console.log({
    created,
    assignments,
    loansSynced,
    total: NON_TEACHING_STAFF.length,
  });
  console.log('\n=== PAYROLL RUN ===');
  console.log({
    id: calculated.id,
    employeeCount: calculated.employeeCount,
    totalGross: Number(calculated.totalGross),
    totalDeductions: Number(calculated.totalDeductions),
    totalNet: Number(calculated.totalNet),
  });

  for (const ps of detail.payslips) {
    console.log(
      `  ${ps.staffProfile?.employeeCode} | ${ps.staffProfile?.fullName} | gross=${Number(ps.grossSalary)} net=${Number(ps.netSalary)}`,
    );
  }

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
