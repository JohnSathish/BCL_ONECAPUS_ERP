/**
 * Sync teaching faculty from staff_export CSV (Prisma-only — no Nest bootstrap).
 *
 * Safe in Docker/prod with either:
 *   npx tsx scripts/sync-teaching-staff-from-export.ts --dry-run
 *   npx tsx scripts/sync-teaching-staff-from-export.ts
 *
 * VPS:
 *   docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db exec api \
 *     npx tsx scripts/sync-teaching-staff-from-export.ts --dry-run
 */
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';

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

type StaffRow = {
  id: string;
  fullName: string;
  employeeCode: string;
  shortCode: string | null;
  email: string | null;
  mobile: string | null;
  staffType: string;
  status: string;
  departmentId: string | null;
  designationId: string | null;
  campusId: string | null;
  portalUserId: string | null;
};

const SHORT_CODE_OVERRIDES: Record<string, string> = {
  'MR. BRILLIANT N MARAK': 'BL',
  'MR. SENGMATCHI M. SANGMA': 'SX',
  'SENGBACHI G MOMIN': 'SB',
  'DR. SANGGRA SANGMA': 'SG',
};

const DEPARTMENT_ALIASES: Record<string, string> = {
  environment: 'Environmental Studies Department',
  'environmental studies': 'Environmental Studies Department',
  'environmental studies department': 'Environmental Studies Department',
};

function normalizeStaffName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').replace(/[.']/g, '').toUpperCase();
}

function parseArgs(argv: string[]) {
  const dryRun = argv.includes('--dry-run');
  const csvArg = argv.find((a) => a.startsWith('--csv='));
  const csvPath = csvArg
    ? resolve(csvArg.slice('--csv='.length))
    : resolve(__dirname, 'data/staff_export_teaching.csv');
  return { dryRun, csvPath };
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

function emailSlug(fullName: string): string {
  return fullName
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '.');
}

function isValidEmail(value: string): boolean {
  if (!value || /\s/.test(value)) return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return false;
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
  if (raw.trim().toUpperCase().includes('NON')) return 'NON_TEACHING';
  return 'TEACHING';
}

function mapShiftCategory(shift: string): string {
  const s = shift.toLowerCase();
  if (s.includes('morning')) return 'MORNING';
  if (s.includes('evening')) return 'EVENING';
  if (s.includes('both')) return 'BOTH';
  return 'DAY';
}

function wantsHod(raw: string): boolean {
  const lower = raw.toLowerCase();
  return lower.includes('head of department') || lower === 'hod';
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

async function nextEmployeeCode(
  prisma: PrismaClient,
  tenantId: string,
): Promise<string> {
  const existing = await prisma.staffProfile.findMany({
    where: { tenantId, employeeCode: { startsWith: 'DBCTCH-' } },
    select: { employeeCode: true },
  });
  let max = 0;
  for (const row of existing) {
    const m = row.employeeCode.match(/DBCTCH-(\d+)-(\d+)/i);
    if (m) {
      const n = Number(m[1]) * 1000 + Number(m[2]);
      if (n > max) max = n;
    }
  }
  const next = max + 1;
  const yearPart = String(Math.floor(next / 1000)).padStart(2, '0');
  const seq = String(next % 1000).padStart(3, '0');
  return `DBCTCH-${yearPart}-${seq}`;
}

async function main() {
  const { dryRun, csvPath } = parseArgs(process.argv.slice(2));
  const rows = parseCsv(readFileSync(csvPath, 'utf8'));
  if (!rows.length) throw new Error(`No rows in ${csvPath}`);

  const shortCodes = resolveShortCodes(rows);
  console.log(`CSV: ${csvPath}`);
  console.log(`Rows: ${rows.length} | dryRun=${dryRun}`);

  const prisma = new PrismaClient();
  try {
    const tenant =
      (await prisma.tenant.findFirst({
        where: { name: { contains: 'Don Bosco' } },
      })) ?? (await prisma.tenant.findFirst({ where: { slug: 'demo' } }));
    if (!tenant) throw new Error('Tenant not found');

    const departments = await prisma.department.findMany({
      where: { tenantId: tenant.id, deletedAt: null },
      select: { id: true, name: true, campusId: true },
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

    const shifts = await prisma.shift.findMany({
      where: { tenantId: tenant.id, deletedAt: null, status: 'ACTIVE' },
      select: { id: true, code: true },
    });
    const shiftByCode = new Map(
      shifts.map((s) => [s.code.toUpperCase(), s.id]),
    );

    const existing = (await prisma.staffProfile.findMany({
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
        portalUserId: true,
      },
    })) as StaffRow[];

    if (!dryRun) {
      const cleared = await prisma.staffProfile.updateMany({
        where: { tenantId: tenant.id, shortCode: { not: null } },
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
      const deptKey = row.department.toLowerCase();
      const dept =
        deptByName.get(deptKey) ??
        deptByName.get((DEPARTMENT_ALIASES[deptKey] ?? '').toLowerCase());
      const designation =
        (row.designation
          ? designationByLabel.get(row.designation.toLowerCase())
          : undefined) ?? fallbackDesignation;
      const primaryShiftId =
        teachingShiftCategory === 'MORNING'
          ? (shiftByCode.get('MORNING') ?? null)
          : teachingShiftCategory === 'EVENING'
            ? (shiftByCode.get('EVENING') ?? null)
            : (shiftByCode.get('DAY') ?? null);
      const campusId = dept?.campusId ?? null;

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
            await prisma.staffProfile.update({
              where: { id: match.id },
              data: {
                fullName: row.fullName,
                email,
                mobile: row.mobile || null,
                staffType,
                employmentType: row.employmentType || 'PERMANENT',
                departmentId: dept?.id ?? null,
                designationId: designation.id,
                campusId,
                shortCode,
                primaryShiftId,
                teachingShiftCategory,
                status: 'ACTIVE',
                deletedAt: null,
                ...(row.employeeCode ? { employeeCode: row.employeeCode } : {}),
              },
            });
            if (wantsHod(row.additionalRoles)) {
              await prisma.staffAdditionalRole.upsert({
                where: {
                  staffProfileId_roleCode: {
                    staffProfileId: match.id,
                    roleCode: 'HOD',
                  },
                },
                create: {
                  tenantId: tenant.id,
                  staffProfileId: match.id,
                  roleCode: 'HOD',
                  roleName: 'Head of Department',
                  active: true,
                },
                update: { active: true, roleName: 'Head of Department' },
              });
            }
          }
          updated += 1;
          console.log(
            `UPDATE ${match.employeeCode.padEnd(14)} ${shortCode.padEnd(4)} ${row.fullName} <${email}>`,
          );
          match.shortCode = shortCode;
          match.email = email;
          match.fullName = row.fullName;
          match.staffType = staffType;
          match.status = 'ACTIVE';
        } else {
          if (dryRun) {
            created += 1;
            console.log(
              `CREATE (dry) ${shortCode.padEnd(4)} ${row.fullName} <${email}>`,
            );
            continue;
          }
          const employeeCode =
            row.employeeCode || (await nextEmployeeCode(prisma, tenant.id));
          const id = randomUUID();
          const staff = await prisma.staffProfile.create({
            data: {
              id,
              tenantId: tenant.id,
              employeeCode,
              employeeCodeAutoGenerated: !row.employeeCode,
              fullName: row.fullName,
              email,
              mobile: row.mobile || null,
              staffType,
              employmentType: row.employmentType || 'PERMANENT',
              departmentId: dept?.id ?? null,
              designationId: designation.id,
              campusId,
              shortCode,
              primaryShiftId,
              teachingShiftCategory,
              status: 'ACTIVE',
              joiningDate: new Date('2024-01-01'),
            },
          });
          if (wantsHod(row.additionalRoles)) {
            await prisma.staffAdditionalRole.create({
              data: {
                tenantId: tenant.id,
                staffProfileId: staff.id,
                roleCode: 'HOD',
                roleName: 'Head of Department',
                active: true,
              },
            });
          }
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
            portalUserId: staff.portalUserId,
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
        s.staffType === 'TEACHING' &&
        s.status === 'ACTIVE' &&
        !keepIds.has(s.id),
    );

    let deactivated = 0;
    for (const extra of teachingExtras) {
      if (!dryRun) {
        try {
          await prisma.staffProfile.update({
            where: { id: extra.id },
            data: {
              shortCode: null,
              status: 'INACTIVE',
              deletedAt: new Date(),
            },
          });
          if (extra.portalUserId) {
            await prisma.user.update({
              where: { id: extra.portalUserId },
              data: { isActive: false, accountStatus: 'inactive' },
            });
          }
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
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
