/**
 * Import St. Luke's teaching staff register into school SIS.
 *
 *   npx tsx scripts/import-st-lukes-staff.ts
 *   npx tsx scripts/import-st-lukes-staff.ts --apply
 *
 * Does not invent missing personal details. Does not touch college Staff tables or TPS.
 */
import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const XLSX =
  process.env.SLS_STAFF_XLSX ||
  String.raw`C:\Users\johnm\Downloads\St_Lukes_Teaching_Staff_Cleaned.xlsx`;

function cell(v: unknown) {
  if (v == null) return '';
  return String(v).replace(/\s+/g, ' ').trim();
}

function parseLooseDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  const s = cell(v);
  const m = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function designationFromAssigned(assigned: string) {
  const v = assigned.trim();
  if (/^principal$/i.test(v)) return 'Principal';
  if (/head\s*mistress/i.test(v)) return 'Head Mistress';
  return 'Teacher';
}

function trainingLabel(v: string) {
  const t = v.trim();
  if (!t) return null;
  if (/^trained$/i.test(t)) return 'Trained';
  if (/^untrained$/i.test(t)) return 'Untrained';
  return t;
}

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'st-lukes-tura' },
  });
  if (!tenant)
    throw new Error(
      'st-lukes-tura tenant not found. Run ensure-st-lukes-school.ts first.',
    );

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX);
  const sheet = wb.getWorksheet('Teaching Staff') ?? wb.worksheets[0];
  if (!sheet) throw new Error('Teaching Staff sheet missing');

  const header = new Map<string, number>();
  sheet.getRow(1).eachCell((c, col) => header.set(cell(c.value), col));
  const col = (name: string) => header.get(name);

  type Row = {
    employeeCode: string;
    fullName: string;
    fatherSpouseName: string | null;
    dateOfBirth: Date | null;
    academicQualification: string | null;
    professionalQualification: string | null;
    teachingExperience: string | null;
    classAssigned: string | null;
    joiningDate: Date | null;
    trainingStatus: string | null;
    designation: string;
  };

  const incoming: Row[] = [];
  sheet.eachRow((excelRow, n) => {
    if (n === 1) return;
    const fullName = cell(excelRow.getCell(col('Full Name') ?? 2).value);
    const employeeCode = cell(
      excelRow.getCell(col('Staff ID') ?? 1).value,
    ).toUpperCase();
    if (!fullName || !employeeCode) return;
    const assigned = cell(excelRow.getCell(col('Class Assigned') ?? 8).value);
    incoming.push({
      employeeCode,
      fullName,
      fatherSpouseName:
        cell(excelRow.getCell(col('Father / Spouse Name') ?? 3).value) || null,
      dateOfBirth: parseLooseDate(
        excelRow.getCell(col('Date of Birth') ?? 4).value,
      ),
      academicQualification:
        cell(excelRow.getCell(col('Academic Qualification') ?? 5).value) ||
        null,
      professionalQualification:
        cell(excelRow.getCell(col('Professional Qualification') ?? 6).value) ||
        null,
      teachingExperience:
        cell(excelRow.getCell(col('Teaching Experience') ?? 7).value) || null,
      classAssigned: assigned || null,
      joiningDate: parseLooseDate(
        excelRow.getCell(col('Appointment Date') ?? 9).value,
      ),
      trainingStatus: trainingLabel(
        cell(excelRow.getCell(col('Training Status') ?? 10).value),
      ),
      designation: designationFromAssigned(assigned),
    });
  });

  const existing = await prisma.schoolStaff.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      fatherSpouseName: true,
      dateOfBirth: true,
      academicQualification: true,
      professionalQualification: true,
      teachingExperience: true,
      classAssigned: true,
      joiningDate: true,
      trainingStatus: true,
      designation: true,
    },
  });
  const byCode = new Map(
    existing.map((s) => [s.employeeCode.toUpperCase(), s]),
  );

  const toCreate = incoming.filter((r) => !byCode.has(r.employeeCode));
  const toFill = incoming.filter((r) => byCode.has(r.employeeCode));

  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`Excel rows: ${incoming.length}`);
  console.log(
    `Already in SIS: ${toFill.length} (blank source fields will be filled; existing values kept)`,
  );
  console.log(`Will create: ${toCreate.length}`);
  for (const r of incoming) {
    console.log(
      `  ${r.employeeCode}  ${r.fullName}  ${r.designation}${r.classAssigned && r.designation === 'Teacher' ? ` · ${r.classAssigned}` : ''}  ${r.trainingStatus ?? ''}`,
    );
  }

  if (!APPLY) {
    console.log('\nRe-run with --apply to write SchoolStaff rows.');
    return;
  }

  const blank = (v: string | Date | null | undefined) =>
    v == null || (typeof v === 'string' && !v.trim());

  let created = 0;
  for (const row of toCreate) {
    await prisma.schoolStaff.create({
      data: {
        tenantId: tenant.id,
        employeeCode: row.employeeCode,
        fullName: row.fullName,
        staffType: 'TEACHING',
        designation: row.designation,
        fatherSpouseName: row.fatherSpouseName,
        dateOfBirth: row.dateOfBirth,
        academicQualification: row.academicQualification,
        professionalQualification: row.professionalQualification,
        teachingExperience: row.teachingExperience,
        classAssigned: row.classAssigned,
        joiningDate: row.joiningDate,
        trainingStatus: row.trainingStatus,
        status: 'ACTIVE',
        extrasJson: {},
      },
    });
    created += 1;
  }

  let updated = 0;
  for (const row of toFill) {
    const cur = byCode.get(row.employeeCode)!;
    const data: Record<string, unknown> = {};
    if (blank(cur.fullName) && row.fullName) data.fullName = row.fullName;
    if (blank(cur.designation) && row.designation)
      data.designation = row.designation;
    if (blank(cur.fatherSpouseName) && row.fatherSpouseName)
      data.fatherSpouseName = row.fatherSpouseName;
    if (blank(cur.dateOfBirth) && row.dateOfBirth)
      data.dateOfBirth = row.dateOfBirth;
    if (blank(cur.academicQualification) && row.academicQualification) {
      data.academicQualification = row.academicQualification;
    }
    if (blank(cur.professionalQualification) && row.professionalQualification) {
      data.professionalQualification = row.professionalQualification;
    }
    if (blank(cur.teachingExperience) && row.teachingExperience)
      data.teachingExperience = row.teachingExperience;
    if (blank(cur.classAssigned) && row.classAssigned)
      data.classAssigned = row.classAssigned;
    if (blank(cur.joiningDate) && row.joiningDate)
      data.joiningDate = row.joiningDate;
    if (blank(cur.trainingStatus) && row.trainingStatus)
      data.trainingStatus = row.trainingStatus;
    if (Object.keys(data).length === 0) continue;
    await prisma.schoolStaff.update({ where: { id: cur.id }, data });
    updated += 1;
  }
  console.log(
    `Created ${created} staff. Filled blanks on ${updated} existing rows.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
