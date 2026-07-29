/**
 * Sync teaching faculty from staff_export CSV (keep-list).
 *
 * - Upserts every CSV faculty row (short code + email when missing)
 * - Resolves short-code collisions to campus-unique values
 * - Soft-deactivates TEACHING staff not present in the CSV
 * - Leaves NON_TEACHING / other staff types alone
 *
 * Usage:
 *   npx ts-node --transpile-only scripts/sync-teaching-staff-from-export.ts
 *   npx ts-node --transpile-only scripts/sync-teaching-staff-from-export.ts --dry-run
 *   npx ts-node --transpile-only scripts/sync-teaching-staff-from-export.ts --csv=path/to.csv
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import type { JwtUser } from '../src/common/decorators/current-user.decorator';
import { PrismaService } from '../src/database/prisma.service';
import { StaffEmploymentService } from '../src/modules/staff/services/staff-employment.service';
import { StaffProvisioningService } from '../src/modules/staff/services/staff-provisioning.service';
import {
  normalizeStaffName,
  type TeachingShiftCategory,
} from '../src/modules/staff/services/staff-shift-category';

type CsvRow = {
  id: string;
  employeeCode: string;
  shortCode: string;
  fullName: string;
  email: string;
  mobile: string;
  staffTypeRaw: string;
  employmentType: string;
  department: string;
  designation: string;
  additionalRoles: string;
  shift: string;
  status: string;
};

/** Prefer stable codes for known collisions in the export. */
const SHORT_CODE_OVERRIDES: Record<string, string> = {
  // BM used by Binendro — Brilliant needs a distinct code
  'MR. BRILLIANT N MARAK': 'BL',
  // SM used by Suzan — others need distinct codes
  'MR. SENGMATCHI M. SANGMA': 'SX',
  'SENGBACHI G MOMIN': 'SB',
  // SA used by Sabrina — Sanggra needs a distinct code
  'DR. SANGGRA SANGMA': 'SG',
};

const DEPARTMENT_ALIASES: Record<string, string> = {
  environment: 'Environmental Studies Department',
  'environmental studies': 'Environmental Studies Department',
  'environmental studies department': 'Environmental Studies Department',
};

function parseArgs(argv: string[]) {
  const dryRun = argv.includes('--dry-run');
  const csvArg = argv.find((a) => a.startsWith('--csv='));
  const csvPath = csvArg
    ? resolve(csvArg.slice('--csv='.length))
    : resolve(__dirname, 'data/staff_export_teaching.csv');
  return { dryRun, csvPath };
}

function parseCsv(text: string): CsvRow[] {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = splitCsvLine(lines[i]!);
    const fullName = (cols[3] ?? '').trim();
    if (!fullName) continue;
    rows.push({
      id: (cols[0] ?? '').trim(),
      employeeCode: (cols[1] ?? '').trim(),
      shortCode: (cols[2] ?? '').trim().toUpperCase(),
      fullName,
      email: (cols[4] ?? '').trim(),
      mobile: (cols[5] ?? '').trim(),
      staffTypeRaw: (cols[6] ?? '').trim(),
      employmentType: (cols[7] ?? '').trim() || 'PERMANENT',
      department: (cols[8] ?? '').trim(),
      designation: (cols[9] ?? '').trim(),
      additionalRoles: (cols[10] ?? '').trim(),
      shift: (cols[11] ?? '').trim(),
      status: (cols[12] ?? '').trim() || 'ACTIVE',
    });
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function emailSlug(fullName: string): string {
  return fullName
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '.');
}

function isValidEmail(value: string): boolean {
  if (!value) return false;
  if (/\s/.test(value)) return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return false;
  // Reject obvious bad domains like "@com"
  const domain = value.split('@')[1] ?? '';
  if (!domain.includes('.') || domain.split('.').pop()!.length < 2)
    return false;
  return true;
}

function normalizeEmail(
  raw: string,
  fullName: string,
  shortCode: string,
): string {
  let email = raw.trim().toLowerCase().replace(/\s+/g, '');
  email = email
    .replace(/@gmail\.comm$/, '@gmail.com')
    .replace(/donboscocollge\.ac\.in$/, 'donboscocollege.ac.in')
    .replace(/@com$/, '@gmail.com');

  if (isValidEmail(email)) return email;
  const slug = emailSlug(fullName) || shortCode.toLowerCase() || 'faculty';
  return `${slug}@dbc-faculty.placeholder`;
}

function mapStaffType(raw: string): string {
  const value = raw.trim().toUpperCase();
  // This CSV is the teaching faculty keep-list (incl. Principal / VP who teach).
  if (value.includes('NON')) return 'NON_TEACHING';
  return 'TEACHING';
}

function mapShiftCategory(shift: string): TeachingShiftCategory {
  const s = shift.toLowerCase();
  if (s.includes('morning')) return 'MORNING';
  if (s.includes('evening')) return 'EVENING';
  if (s.includes('both')) return 'BOTH';
  return 'DAY';
}

function mapAdditionalRoles(raw: string): string[] {
  const lower = raw.toLowerCase();
  if (lower.includes('head of department') || lower === 'hod') return ['HOD'];
  return [];
}

function resolveShortCodes(rows: CsvRow[]): Map<string, string> {
  const byName = new Map<string, string>();
  const used = new Set<string>();

  for (const row of rows) {
    const nameKey = normalizeStaffName(row.fullName);
    const override =
      SHORT_CODE_OVERRIDES[nameKey] ??
      SHORT_CODE_OVERRIDES[row.fullName.toUpperCase()];
    let code = (override ?? row.shortCode ?? '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');

    if (!code) {
      const parts = nameKey.split(' ').filter(Boolean);
      code = (
        (parts[0]?.[0] ?? 'X') + (parts[parts.length - 1]?.[0] ?? 'X')
      ).toUpperCase();
    }

    if (used.has(code)) {
      const parts = nameKey.split(' ').filter(Boolean);
      const altCandidates = [
        code + (parts[1]?.[0] ?? 'X'),
        (parts[0]?.slice(0, 2) ?? 'XX').toUpperCase(),
        (parts[parts.length - 1]?.slice(0, 2) ?? 'XX').toUpperCase(),
        code + '2',
        code + '3',
      ];
      const alt = altCandidates.find((c) => c && !used.has(c));
      code = (alt ?? `${code}${used.size}`).toUpperCase().slice(0, 4);
    }

    used.add(code);
    byName.set(nameKey, code);
  }
  return byName;
}

async function main() {
  const { dryRun, csvPath } = parseArgs(process.argv.slice(2));
  const rows = parseCsv(readFileSync(csvPath, 'utf8'));
  if (!rows.length) throw new Error(`No rows in ${csvPath}`);

  const shortCodes = resolveShortCodes(rows);
  console.log(`CSV: ${csvPath}`);
  console.log(`Rows: ${rows.length} | dryRun=${dryRun}`);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
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
  void user;

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

  const designations = await prisma.designation.findMany({
    where: { tenantId: tenant.id, isActive: true },
    select: { id: true, label: true },
  });
  const designationByLabel = new Map(
    designations.map((d) => [d.label.trim().toLowerCase(), d]),
  );
  const fallbackDesignation =
    designationByLabel.get('assistant professor') ??
    designations.find((d) =>
      d.label.toLowerCase().includes('assistant professor'),
    ) ??
    designations[0];
  if (!fallbackDesignation) throw new Error('No designation found');

  const existing = await prisma.staffProfile.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
    select: {
      id: true,
      fullName: true,
      employeeCode: true,
      shortCode: true,
      email: true,
      mobile: true,
      staffType: true,
      status: true,
      departmentId: true,
      designationId: true,
      campusId: true,
    },
  });

  // Free campus short codes before re-assigning (incl. soft-deleted rows —
  // @@unique([campusId, shortCode]) is not partial).
  if (!dryRun) {
    const cleared = await prisma.staffProfile.updateMany({
      where: {
        tenantId: tenant.id,
        shortCode: { not: null },
      },
      data: { shortCode: null },
    });
    console.log(`Cleared short codes on ${cleared.count} staff rows`);
  }

  const keepIds = new Set<string>();
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const nameKey = normalizeStaffName(row.fullName);
    const shortCode = shortCodes.get(nameKey)!;
    const email = normalizeEmail(row.email, row.fullName, shortCode);
    const staffType = mapStaffType(row.staffTypeRaw);
    const teachingShiftCategory = mapShiftCategory(row.shift);
    const additionalRoleCodes = mapAdditionalRoles(row.additionalRoles);

    const deptKey = row.department.toLowerCase();
    const dept =
      deptByName.get(deptKey) ??
      deptByName.get((DEPARTMENT_ALIASES[deptKey] ?? '').toLowerCase());

    const designation =
      (row.designation
        ? designationByLabel.get(row.designation.toLowerCase())
        : undefined) ?? fallbackDesignation;

    let match =
      (row.id ? existing.find((s) => s.id === row.id) : undefined) ??
      (row.employeeCode
        ? existing.find(
            (s) =>
              s.employeeCode.toUpperCase() === row.employeeCode.toUpperCase(),
          )
        : undefined) ??
      existing.find((s) => normalizeStaffName(s.fullName) === nameKey);

    if (!match) {
      const tokens = nameKey.split(' ').filter((t) => t.length > 2);
      const partial = existing.filter((s) => {
        const st = normalizeStaffName(s.fullName);
        return tokens.length >= 2 && tokens.every((t) => st.includes(t));
      });
      if (partial.length === 1) match = partial[0];
      else if (partial.length > 1) {
        errors.push(`AMBIGUOUS ${row.fullName}`);
        skipped += 1;
        continue;
      }
    }

    try {
      if (match) {
        keepIds.add(match.id);
        if (!dryRun) {
          await provisioning.mergeFromImport(
            tenant.id,
            match.id,
            {
              fullName: row.fullName,
              email,
              mobile: row.mobile || undefined,
              staffType,
              employmentType: row.employmentType || 'PERMANENT',
              departmentId: dept?.id,
              designationId: designation.id,
              status: 'ACTIVE',
              createPortalAccount: false,
              employeeCode: row.employeeCode || undefined,
              employeeCodeAutoGenerated: !row.employeeCode,
            },
            'MERGE',
            admin.id,
          );
          await employment.applyEmploymentUpdate(tenant.id, match.id, {
            staffType,
            employmentType: row.employmentType || 'PERMANENT',
            status: 'ACTIVE',
            departmentId: dept?.id ?? null,
            designationId: designation.id,
            teachingShiftCategory:
              staffType === 'TEACHING' ? teachingShiftCategory : undefined,
            shortCode,
            additionalRoleCodes:
              additionalRoleCodes.length > 0 ? additionalRoleCodes : undefined,
          });
        }
        updated += 1;
        console.log(
          `UPDATE ${match.employeeCode.padEnd(14)} ${shortCode.padEnd(4)} ${row.fullName} <${email}>`,
        );
        match.shortCode = shortCode;
        match.email = email;
        match.fullName = row.fullName;
        match.staffType = staffType;
      } else {
        if (dryRun) {
          created += 1;
          console.log(
            `CREATE (dry) ${shortCode.padEnd(4)} ${row.fullName} <${email}>`,
          );
          continue;
        }
        const { staff } = await provisioning.create(
          tenant.id,
          {
            fullName: row.fullName,
            email,
            mobile: row.mobile || undefined,
            staffType,
            employmentType: row.employmentType || 'PERMANENT',
            departmentId: dept?.id,
            designationId: designation.id,
            teachingShiftCategory:
              staffType === 'TEACHING' ? teachingShiftCategory : undefined,
            shortCode,
            additionalRoleCodes:
              additionalRoleCodes.length > 0 ? additionalRoleCodes : undefined,
            status: 'ACTIVE',
            createPortalAccount: false,
            employeeCode: row.employeeCode || undefined,
            employeeCodeAutoGenerated: !row.employeeCode,
            joiningDate: '2024-01-01',
          },
          admin.id,
        );
        keepIds.add(staff.id);
        existing.push({
          id: staff.id,
          fullName: staff.fullName,
          employeeCode: staff.employeeCode,
          shortCode: staff.shortCode,
          email: staff.email,
          mobile: staff.mobile,
          staffType: staff.staffType,
          status: staff.status,
          departmentId: staff.departmentId,
          designationId: staff.designationId,
          campusId: staff.campusId,
        });
        created += 1;
        console.log(
          `CREATE  ${staff.employeeCode.padEnd(14)} ${shortCode.padEnd(4)} ${row.fullName} <${email}>`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${row.fullName}: ${msg}`);
      console.error(`FAIL ${row.fullName}: ${msg}`);
    }
  }

  const teachingExtras = existing.filter(
    (s) =>
      s.staffType === 'TEACHING' && s.status === 'ACTIVE' && !keepIds.has(s.id),
  );

  let deactivated = 0;
  for (const extra of teachingExtras) {
    if (!dryRun) {
      try {
        await prisma.staffProfile.update({
          where: { id: extra.id },
          data: { shortCode: null },
        });
        await provisioning.deactivate(tenant.id, extra.id);
        deactivated += 1;
        console.log(
          `DEACTIVATE ${extra.employeeCode.padEnd(14)} ${extra.fullName}`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`deactivate ${extra.fullName}: ${msg}`);
      }
    } else {
      deactivated += 1;
      console.log(
        `DEACTIVATE (dry) ${extra.employeeCode.padEnd(14)} ${extra.fullName}`,
      );
    }
  }

  console.log('\nSummary');
  console.log({
    tenant: tenant.slug,
    csvRows: rows.length,
    updated,
    created,
    deactivated,
    skipped,
    errors: errors.length,
    dryRun,
  });
  if (errors.length) {
    console.log('Errors:');
    for (const e of errors) console.log(` - ${e}`);
  }

  try {
    await app.close();
  } catch {
    // Redis may already be closed during script shutdown.
  }
  if (errors.length) process.exit(1);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
