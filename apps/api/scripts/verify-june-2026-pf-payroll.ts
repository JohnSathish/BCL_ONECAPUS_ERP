import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import type { JwtUser } from '../src/common/decorators/current-user.decorator';
import { PrismaService } from '../src/database/prisma.service';
import { PayrollRunEngineService } from '../src/modules/payroll/services/payroll-run-engine.service';
import {
  buildStaffLookup,
  loadLegacyTeachingRows,
  matchStaffToSheetRow,
} from './lib/salary-xlsx-parse';

function lineAmt(
  lines: Array<{ componentCode: string; amount: unknown }>,
  ...codes: string[]
) {
  for (const code of codes) {
    const row = lines.find((l) => l.componentCode === code);
    if (row != null) return Number(row.amount) || 0;
  }
  return 0;
}

function hasAccommodationDeduction(lines: Array<{ componentCode: string }>) {
  return lines.some(
    (l) =>
      l.componentCode.startsWith('QUARTER_') ||
      l.componentCode.startsWith('ACCOM_') ||
      l.componentCode === 'QUARTER_RENT',
  );
}

function ppfTotalFromLines(
  lines: Array<{ componentCode: string; amount: unknown }>,
  pfEmployer: number,
) {
  const pfEmployee = lineAmt(lines, 'PF_EMPLOYEE');
  const ppf = lineAmt(lines, 'PPF');
  if (pfEmployee + ppf > 0) return pfEmployee + ppf;
  if (pfEmployer > 0) return pfEmployer * 2;
  return 0;
}

async function main() {
  const skipRecalculate = process.argv.includes('--skip-recalculate');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const prisma = app.get(PrismaService);
  const runs = app.get(PayrollRunEngineService);

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

  const run = await prisma.payrollRun.findFirst({
    where: {
      tenantId: tenant.id,
      month: 6,
      year: 2026,
      payScaleType: 'COLLEGE_TEACHING',
    },
  });
  if (!run) throw new Error('June 2026 COLLEGE_TEACHING payroll run not found');

  if (!skipRecalculate) {
    console.log(
      `\nRecalculating payroll run ${run.id} (${run.label ?? 'June 2026'})…`,
    );
    if (run.locked)
      throw new Error('Payroll run is locked — reopen before recalculating');
    await runs.calculate(user, run.id);
    console.log('Calculate complete.\n');
  }

  const detail = await runs.getRun(tenant.id, run.id);
  const sheetRows = await loadLegacyTeachingRows();

  const staffProfiles = await prisma.staffProfile.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
    select: { id: true, employeeCode: true, fullName: true },
  });
  const lookup = buildStaffLookup(staffProfiles);

  const sheetByStaffId = new Map<string, (typeof sheetRows)[0]>();
  for (const row of sheetRows) {
    const matched = matchStaffToSheetRow(row, lookup, staffProfiles);
    if (matched) sheetByStaffId.set(matched.staff.id, row);
  }

  const pfConfigs = await prisma.staffPfConfig.findMany({
    where: { tenantId: tenant.id },
  });
  const pfConfigByStaff = new Map(pfConfigs.map((c) => [c.staffProfileId, c]));

  let enrolledCount = 0;
  let exemptCount = 0;
  let enrolledPfEmployer = 0;
  let enrolledPpf = 0;

  const pfStatusMismatches: string[] = [];
  const pfAmountMismatches: string[] = [];
  const netMismatches: string[] = [];
  const missingOnSheet: string[] = [];
  const crossTab: string[] = [];

  for (const ps of detail.payslips) {
    const lines = ps.lines ?? [];
    const name = ps.staffProfile?.fullName ?? '';
    const staffId = ps.staffProfileId;
    const sheet = sheetByStaffId.get(staffId);

    const basic = lineAmt(lines, 'BASIC');
    const pfEmployer = lineAmt(lines, 'PF_EMPLOYER', 'PF_EARNING', 'PF');
    const ppfTotal = ppfTotalFromLines(lines, pfEmployer);
    const houseRent = lineAmt(lines, 'HOUSE_RENT');
    const loan = lineAmt(lines, 'LOAN');
    const gross = Number(ps.grossSalary);
    const net = Number(ps.netSalary);
    const pfExempt = pfEmployer === 0 && ppfTotal === 0;
    const accommodation = hasAccommodationDeduction(lines);
    const cfg = pfConfigByStaff.get(staffId);

    if (pfExempt) exemptCount += 1;
    else {
      enrolledCount += 1;
      enrolledPfEmployer += pfEmployer;
      enrolledPpf += ppfTotal;
    }

    if (!sheet) {
      missingOnSheet.push(name);
      continue;
    }

    crossTab.push(
      `${name}: sheet=${sheet.pfExempt ? 'exempt' : 'enrolled'} config=${cfg?.pfEnabled === false ? 'disabled' : cfg?.pfEnabled === true ? 'enabled' : 'default'} erp=${pfExempt ? 'exempt' : 'enrolled'}`,
    );

    if (sheet.pfExempt !== pfExempt) {
      pfStatusMismatches.push(
        `${name} — sheet=${sheet.pfExempt ? 'exempt' : 'enrolled'}, ERP=${pfExempt ? 'exempt' : 'enrolled'}`,
      );
    }

    const tol = 1;
    for (const [label, erp, expected] of [
      ['Basic', basic, sheet.basic],
      ['PF Employer', pfEmployer, sheet.pfEmployer],
      ['PPF', ppfTotal, sheet.ppf],
    ] as const) {
      if (Math.abs(erp - expected) > tol) {
        pfAmountMismatches.push(
          `${name}: ${label} ERP=${erp} sheet=${expected} (Δ ${erp - expected})`,
        );
      }
    }

    if (Math.abs(gross - sheet.gross) > tol) {
      pfAmountMismatches.push(
        `${name}: Gross ERP=${gross} sheet=${sheet.gross} (Δ ${gross - sheet.gross})`,
      );
    }

    if (!accommodation && Math.abs(net - sheet.net) > tol) {
      netMismatches.push(
        `${name}: Net ERP=${net} sheet=${sheet.net} (Δ ${net - sheet.net})`,
      );
    } else if (accommodation && Math.abs(net - sheet.net) > tol) {
      netMismatches.push(
        `${name}: Net ERP=${net} sheet=${sheet.net} (Δ ${net - sheet.net}) [accommodation — PF OK]`,
      );
    }
  }

  const sheetEnrolled = sheetRows.filter((r) => !r.pfExempt);
  const sheetExempt = sheetRows.filter((r) => r.pfExempt);

  console.log('=== PF ENROLLMENT SUMMARY ===');
  console.log(
    `ERP payslips: ${detail.payslips.length} (${enrolledCount} enrolled, ${exemptCount} exempt)`,
  );
  console.log(
    `Salary sheet:   ${sheetRows.length} (${sheetEnrolled.length} enrolled, ${sheetExempt.length} exempt)`,
  );
  console.log('');
  console.log('=== ENROLLED PF TOTALS (ERP) ===');
  console.log(
    `Employer PF sum: ₹${enrolledPfEmployer.toLocaleString('en-IN')}`,
  );
  console.log(`PPF sum:         ₹${enrolledPpf.toLocaleString('en-IN')}`);
  console.log('');
  console.log('=== ENROLLED PF TOTALS (Sheet) ===');
  console.log(
    `Employer PF sum: ₹${sheetEnrolled.reduce((s, r) => s + r.pfEmployer, 0).toLocaleString('en-IN')}`,
  );
  console.log(
    `PPF sum:         ₹${sheetEnrolled.reduce((s, r) => s + r.ppf, 0).toLocaleString('en-IN')}`,
  );

  if (pfStatusMismatches.length) {
    console.log(
      `\n=== PF STATUS MISMATCHES (${pfStatusMismatches.length}) ===`,
    );
    pfStatusMismatches.forEach((m) => console.log(m));
  } else {
    console.log(
      '\n✓ PF enrollment status matches sheet for all matched staff.',
    );
  }

  if (pfAmountMismatches.length) {
    console.log(
      `\n=== PF / GROSS AMOUNT MISMATCHES (${pfAmountMismatches.length}) ===`,
    );
    pfAmountMismatches.slice(0, 30).forEach((m) => console.log(m));
    if (pfAmountMismatches.length > 30)
      console.log(`… and ${pfAmountMismatches.length - 30} more`);
  } else {
    console.log(
      '\n✓ Basic / PF Employer / PPF / Gross align with sheet (±₹1).',
    );
  }

  if (netMismatches.length) {
    console.log(`\n=== NET SALARY NOTES (${netMismatches.length}) ===`);
    netMismatches.slice(0, 15).forEach((m) => console.log(m));
    if (netMismatches.length > 15)
      console.log(`… and ${netMismatches.length - 15} more`);
  }

  if (missingOnSheet.length) {
    console.log(`\n=== NOT ON SHEET (${missingOnSheet.length}) ===`);
    missingOnSheet.forEach((n) => console.log(`  ${n}`));
  }

  const pfConfigDisabled = await prisma.staffPfConfig.count({
    where: { tenantId: tenant.id, pfEnabled: false },
  });
  console.log(`\nStaff PF config records (disabled): ${pfConfigDisabled}`);

  await app.close();

  const failed = pfStatusMismatches.length > 0 || pfAmountMismatches.length > 0;
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
