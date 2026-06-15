/**
 * Import / update Morning Shift teaching staff without creating duplicates.
 * Run: npx ts-node --transpile-only scripts/import-morning-shift-staff.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import type { JwtUser } from '../src/common/decorators/current-user.decorator';
import { PrismaService } from '../src/database/prisma.service';
import { StaffEmploymentService } from '../src/modules/staff/services/staff-employment.service';
import { StaffProvisioningService } from '../src/modules/staff/services/staff-provisioning.service';
import { normalizeStaffName } from '../src/modules/staff/services/staff-shift-category';

type MorningStaffSeed = {
  fullName: string;
  department: string;
};

const DEPARTMENT_ALIASES: Record<string, string> = {
  environment: 'Environmental Studies Department',
};

const NAME_ALIASES: Record<string, string> = {
  'AMBALIKA D SANGMA': 'AMBALIKA M MARAK',
};

const MORNING_SHIFT_STAFF: MorningStaffSeed[] = [
  { fullName: 'CHONRE CH MARAK', department: 'Economics' },
  { fullName: 'BRITHUEL G SANGMA', department: 'Economics' },
  { fullName: 'CHANCHIAMAN R MARAK', department: 'Economics' },
  { fullName: 'ALBERT S TIRKEY', department: 'Education' },
  { fullName: 'NOKME M MARAK', department: 'Education' },
  { fullName: 'RUBITHA A SANGMA', department: 'Education' },
  { fullName: 'BENOBITHA M SANGMA', department: 'English' },
  { fullName: 'UZZIEL S MOMIN', department: 'English' },
  { fullName: 'THOMAS M MARAK', department: 'English' },
  { fullName: 'KASAAN CHOKCHIM M SANGMA', department: 'English' },
  { fullName: 'AKSANA NEHA CH MARAK', department: 'Environment' },
  { fullName: 'CHICHI CH SANGMA', department: 'Environment' },
  { fullName: 'RINGSE RANI PATRINGCHI K MARAK', department: 'Garo' },
  { fullName: 'GRIPSENG G MOMIN', department: 'Garo' },
  { fullName: 'BINDARASH R MARAK', department: 'Garo' },
  { fullName: 'KSANBOR KHARKONGOR', department: 'Geography' },
  { fullName: 'ALWISHA T SANGMA', department: 'Geography' },
  { fullName: 'CHARE N SANGMA', department: 'Geography' },
  { fullName: 'AMBALIKA D SANGMA', department: 'History' },
  { fullName: 'SUZAN MARYL S MARAK', department: 'History' },
  { fullName: 'MARCUCH SANGMA', department: 'History' },
  { fullName: 'FRIANGKY M MARAK', department: 'Philosophy' },
  { fullName: 'SONATCHI T SANGMA', department: 'Philosophy' },
  { fullName: 'ISSAC WASA', department: 'Philosophy' },
  { fullName: 'NIKJRANG A SANGMA', department: 'Political Science' },
  { fullName: 'JESTERFIELD D SANGMA', department: 'Political Science' },
  { fullName: 'SALMAN', department: 'Political Science' },
  { fullName: 'JUDALIN KHARSHANDI', department: 'Sociology' },
  { fullName: 'TUSUMIKA ADHIKARI', department: 'Sociology' },
  { fullName: 'RENCHI CH SANGMA', department: 'Sociology' },
];

function emailSlug(fullName: string): string {
  return fullName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '.');
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error'],
  });
  const prisma = app.get(PrismaService);
  const provisioning = app.get(StaffProvisioningService);
  const employment = app.get(StaffEmploymentService);

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

  const departments = await prisma.department.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
    select: { id: true, name: true, code: true },
  });
  const deptByName = new Map(
    departments.map((d) => [d.name.trim().toLowerCase(), d]),
  );
  for (const [alias, deptName] of Object.entries(DEPARTMENT_ALIASES)) {
    const dept = departments.find(
      (d) => d.name.toLowerCase() === deptName.toLowerCase(),
    );
    if (dept) deptByName.set(alias, dept);
  }

  const designation =
    (await prisma.designation.findFirst({
      where: {
        tenantId: tenant.id,
        isActive: true,
        label: { contains: 'Assistant Professor', mode: 'insensitive' },
      },
    })) ??
    (await prisma.designation.findFirst({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: { sortOrder: 'asc' },
    }));
  if (!designation) throw new Error('No designation found');

  const shiftIds = await employment.loadTeachingShiftIds(tenant.id);
  if (!shiftIds.morningId)
    throw new Error('Morning Shift (MORNING) not configured');

  const existing = await prisma.staffProfile.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
    select: {
      id: true,
      fullName: true,
      employeeCode: true,
      mobile: true,
      teachingShiftCategory: true,
      department: { select: { name: true } },
    },
  });

  let updated = 0;
  let created = 0;
  let skipped = 0;
  const unmatched: string[] = [];

  for (const row of MORNING_SHIFT_STAFF) {
    const aliasKey = NAME_ALIASES[normalizeStaffName(row.fullName)];
    const key = aliasKey ?? normalizeStaffName(row.fullName);
    const dept =
      deptByName.get(row.department.toLowerCase()) ??
      deptByName.get(
        (DEPARTMENT_ALIASES[row.department.toLowerCase()] ?? '').toLowerCase(),
      );

    const exact = existing.find((s) => normalizeStaffName(s.fullName) === key);
    const significantTokens = key.split(' ').filter((t) => t.length > 2);
    const partial =
      !exact &&
      existing.filter((s) => {
        const st = normalizeStaffName(s.fullName);
        return (
          significantTokens.length >= 2 &&
          significantTokens.every((t) => st.includes(t))
        );
      });
    const match = exact ?? (partial.length === 1 ? partial[0] : undefined);

    if (!match && partial.length > 1) {
      console.warn(
        `AMBIGUOUS ${row.fullName}: ${partial.map((p) => p.fullName).join('; ')}`,
      );
      unmatched.push(row.fullName);
      continue;
    }

    if (match) {
      const before = match.teachingShiftCategory;
      await employment.applyTeachingShiftCategory(
        tenant.id,
        match.id,
        'MORNING',
        {
          mergeWithExistingDay: true,
        },
      );
      const after = await prisma.staffProfile.findUnique({
        where: { id: match.id },
        select: { teachingShiftCategory: true },
      });
      updated += 1;
      console.log(
        `UPDATED ${match.employeeCode} | ${match.fullName} | ${before ?? '—'} → ${after?.teachingShiftCategory}`,
      );
      continue;
    }

    const email = `${emailSlug(row.fullName)}@dbc-faculty.placeholder`;
    const { staff: profile } = await provisioning.create(
      tenant.id,
      {
        fullName: row.fullName,
        email,
        staffType: 'TEACHING',
        employmentType: 'PERMANENT',
        departmentId: dept?.id,
        designationId: designation.id,
        primaryShiftId: shiftIds.morningId,
        teachingShiftCategory: 'MORNING',
        joiningDate: '2024-01-01',
        createPortalAccount: false,
        employeeCodeAutoGenerated: true,
      },
      admin.id,
    );
    created += 1;
    existing.push({
      id: profile.id,
      fullName: profile.fullName,
      employeeCode: profile.employeeCode,
      mobile: profile.mobile,
      teachingShiftCategory: 'MORNING',
      department: dept ? { name: dept.name } : null,
    });
    console.log(
      `CREATED ${profile.employeeCode} | ${profile.fullName} | ${row.department}`,
    );
  }

  console.log('\nSummary:');
  console.log({
    total: MORNING_SHIFT_STAFF.length,
    updated,
    created,
    skipped,
    unmatched: unmatched.length,
  });
  if (unmatched.length) {
    console.log('Unmatched:', unmatched.join(', '));
  }

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
