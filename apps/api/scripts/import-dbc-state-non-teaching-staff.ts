/**
 * Import DBC State Scale non-teaching staff from May 2026 salary sheet.
 * Staff category: NON_TEACHING · Pay scale: STATE · Structure: DBC_STATE_NON_TEACHING
 *
 * Run: npx ts-node --transpile-only scripts/import-dbc-state-non-teaching-staff.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import type { JwtUser } from '../src/common/decorators/current-user.decorator';
import { PrismaService } from '../src/database/prisma.service';
import { LoansSetupService } from '../src/modules/loans/services/loans-setup.service';
import { LoansManagementService } from '../src/modules/loans/services/loans-management.service';
import { DbcPayrollSetupService } from '../src/modules/payroll/services/dbc-payroll-setup.service';
import { StaffPayAssignmentService } from '../src/modules/payroll/services/staff-pay-assignment.service';
import { StaffProvisioningService } from '../src/modules/staff/services/staff-provisioning.service';

type StateStaffSeed = {
  fullName: string;
  basicPay: number;
  /** 10 = joined prior to 01.04.2010, 8 = on or after */
  cpfRate: 8 | 10;
  joiningDate: string;
  monthlyLoan?: number;
};

const STATE_NON_TEACHING_STAFF: StateStaffSeed[] = [
  {
    fullName: 'Stephen T Sangma',
    basicPay: 51700,
    cpfRate: 10,
    joiningDate: '2005-04-01',
  },
  {
    fullName: 'Mohamed Ali Shek',
    basicPay: 36400,
    cpfRate: 10,
    joiningDate: '2008-06-01',
    monthlyLoan: 11000,
  },
  {
    fullName: 'J. Susai Sagayaraj',
    basicPay: 36400,
    cpfRate: 10,
    joiningDate: '2007-03-15',
  },
  {
    fullName: 'Luckjy K Sangma',
    basicPay: 35300,
    cpfRate: 10,
    joiningDate: '2006-01-10',
    monthlyLoan: 20000,
  },
  {
    fullName: 'Rehny A Sangma',
    basicPay: 37400,
    cpfRate: 8,
    joiningDate: '2012-07-01',
  },
  {
    fullName: 'Joseph M Marak',
    basicPay: 25500,
    cpfRate: 8,
    joiningDate: '2015-04-01',
  },
  {
    fullName: 'Shiv R Marak',
    basicPay: 25500,
    cpfRate: 8,
    joiningDate: '2014-08-01',
  },
  {
    fullName: 'Tangrey Ch Marak',
    basicPay: 22000,
    cpfRate: 8,
    joiningDate: '2016-05-01',
  },
  {
    fullName: 'Henry S. Sangma',
    basicPay: 20200,
    cpfRate: 8,
    joiningDate: '2018-03-01',
    monthlyLoan: 4000,
  },
];

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').replace(/[.']/g, '').toUpperCase();
}

function emailSlug(fullName: string): string {
  return fullName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '.');
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
  const loansSetup = app.get(LoansSetupService);
  const loans = app.get(LoansManagementService);

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
    where: {
      tenantId: tenant.id,
      code: 'DBC_STATE_NON_TEACHING',
      status: 'ACTIVE',
    },
  });
  if (!payStructure)
    throw new Error('DBC_STATE_NON_TEACHING pay structure not found');

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
  let skipped = 0;
  let assignments = 0;
  let loansCreated = 0;

  for (const row of STATE_NON_TEACHING_STAFF) {
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
          joiningDate: row.joiningDate,
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
      console.log(`CREATED ${employeeCode} | ${row.fullName} | ${email}`);
    } else {
      skipped++;
      if (match!.staffType !== 'NON_TEACHING') {
        await prisma.staffProfile.update({
          where: { id: staffId },
          data: { staffType: 'NON_TEACHING' },
        });
        console.log(
          `UPDATED type → NON_TEACHING: ${employeeCode} | ${row.fullName}`,
        );
      } else {
        console.log(`EXISTS ${employeeCode} | ${row.fullName}`);
      }
    }

    const activeAssignment = await prisma.staffPayAssignment.findFirst({
      where: { tenantId: tenant.id, staffProfileId: staffId, status: 'ACTIVE' },
      include: { payStructureTemplate: { select: { code: true } } },
    });

    const needsAssignment =
      !activeAssignment ||
      activeAssignment.payScaleType !== 'STATE' ||
      activeAssignment.payStructureTemplate?.code !== 'DBC_STATE_NON_TEACHING';

    if (needsAssignment) {
      await payAssignments.create(user, {
        staffProfileId: staffId,
        payStructureTemplateId: payStructure.id,
        payScaleType: 'STATE',
        basicPay: row.basicPay,
        cpfRate: row.cpfRate,
        effectiveFrom: '2026-05-01',
        notes: `Imported State Scale non-teaching — CPF ${row.cpfRate}% (May 2026 sheet)`,
      });
      assignments++;
      console.log(
        `  PAY ASSIGNMENT STATE basic=${row.basicPay} cpf=${row.cpfRate}%`,
      );
    }

    if (row.monthlyLoan && row.monthlyLoan > 0 && welfareType) {
      const existingLoan = await prisma.staffLoan.findFirst({
        where: {
          tenantId: tenant.id,
          staffProfileId: staffId,
          status: { in: ['ACTIVE', 'PAUSED'] },
        },
      });
      if (!existingLoan) {
        const principal = row.monthlyLoan * 24;
        await loans.create(user, {
          staffProfileId: staffId,
          loanTypeConfigId: welfareType.id,
          loanType: welfareType.name ?? 'Staff Welfare Loan',
          principalAmount: principal,
          monthlyInstallment: row.monthlyLoan,
          salaryDeductionAmount: row.monthlyLoan,
          repaymentMethod: 'SALARY_DEDUCTION',
          loanDate: '2026-05-01',
          repaymentStartDate: '2026-05-01',
          notes: 'Imported from May 2026 State Scale salary sheet',
        });
        loansCreated++;
        console.log(`  LOAN monthly=₹${row.monthlyLoan}`);
      }
    }
  }

  console.log('\nSummary:', {
    created,
    skipped,
    assignments,
    loansCreated,
    total: STATE_NON_TEACHING_STAFF.length,
  });
  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
