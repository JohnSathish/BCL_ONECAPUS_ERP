import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import type { JwtUser } from '../src/common/decorators/current-user.decorator';
import { PrismaService } from '../src/database/prisma.service';
import { StaffPayAssignmentService } from '../src/modules/payroll/services/staff-pay-assignment.service';
import { StaffPfConfigService } from '../src/modules/payroll/services/staff-pf-config.service';
import {
  buildStaffLookup,
  EXCLUDED_SALARY_NAMES,
  loadLegacyTeachingRows,
  matchStaffToSheetRow,
  normalizeName,
} from './lib/salary-xlsx-parse';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error'],
  });
  const prisma = app.get(PrismaService);
  const pfConfig = app.get(StaffPfConfigService);
  const assignments = app.get(StaffPayAssignmentService);

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

  const sheetRows = await loadLegacyTeachingRows();
  const staff = await prisma.staffProfile.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
    select: { id: true, employeeCode: true, fullName: true },
  });
  const lookup = buildStaffLookup(staff);

  let skippedExcluded = 0;
  let unmatched = 0;
  let noAssignment = 0;
  let syncedEnrolled = 0;
  let syncedExempt = 0;
  const unmatchedNames: string[] = [];

  for (const row of sheetRows) {
    if (EXCLUDED_SALARY_NAMES.has(normalizeName(row.name))) {
      skippedExcluded += 1;
      continue;
    }

    const matched = matchStaffToSheetRow(row, lookup, staff);
    if (!matched) {
      unmatched += 1;
      unmatchedNames.push(row.name);
      continue;
    }

    const assignment = await prisma.staffPayAssignment.findFirst({
      where: {
        tenantId: tenant.id,
        staffProfileId: matched.staff.id,
        status: 'ACTIVE',
        payScaleType: 'COLLEGE_TEACHING',
      },
    });

    if (!assignment) {
      noAssignment += 1;
      continue;
    }

    await pfConfig.upsert(user, matched.staff.id, {
      pfEnabled: !row.pfExempt,
      employeePfApplicable: !row.pfExempt,
      employerPfApplicable: !row.pfExempt,
      pfScheme: row.pfExempt ? 'NOT_APPLICABLE' : 'PF_12_PERCENT',
      effectiveFrom: assignment.effectiveFrom.toISOString().slice(0, 10),
      remarks: `Synced from salary sheet row ${row.rowNumber} (${matched.method})`,
    });

    await assignments.updateStatutory(user, assignment.id, {
      pfExempt: row.pfExempt,
      houseRent: row.houseRent > 0 ? row.houseRent : 0,
    });

    if (row.pfExempt) {
      syncedExempt += 1;
      console.log('PF exempt:', matched.staff.fullName, `← ${row.name}`);
    } else {
      syncedEnrolled += 1;
    }

    if (matched.warnings.length) {
      console.warn('  warnings:', matched.warnings.join('; '));
    }
  }

  console.log('\n=== PF CONFIG SYNC SUMMARY ===');
  console.log(`Sheet rows:        ${sheetRows.length}`);
  console.log(`Skipped (excluded): ${skippedExcluded}`);
  console.log(`Unmatched:         ${unmatched}`);
  console.log(`No assignment:     ${noAssignment}`);
  console.log(`Synced enrolled:   ${syncedEnrolled}`);
  console.log(`Synced exempt:     ${syncedExempt}`);
  console.log(`Total synced:      ${syncedEnrolled + syncedExempt}`);

  if (unmatchedNames.length) {
    console.log('\nUnmatched sheet names:', unmatchedNames.join(', '));
  }

  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
