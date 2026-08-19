/**
 * Fill college roll + NEHU roll for imported students, matching the office
 * Excel registers used for Sem 1/3/5 CREATE import.
 *
 *   npx tsx scripts/backfill-imported-student-rolls.ts --dry-run
 *   npx tsx scripts/backfill-imported-student-rolls.ts --apply
 */
import * as fs from 'fs';
import * as path from 'path';
import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';
import {
  normalizeOfficeHeader,
  readOfficeIdentity,
} from './lib/office-identity-fields';

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

const apply = process.argv.includes('--apply');
const tenantSlug = readArg('tenant') ?? 'demo';
const sourceRoot =
  readArg('source') ??
  path.join(
    process.env.USERPROFILE ?? '',
    'OneDrive',
    'Desktop',
    'Import Live 1-3-5',
  );
const prisma = new PrismaClient();

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (Number.isInteger(value) || Math.abs(value) >= 1e10) {
      return String(Math.round(value));
    }
    return String(value);
  }
  if (typeof value === 'object') {
    if ('result' in value && value.result != null) {
      return cellText(value.result as ExcelJS.CellValue);
    }
    if ('text' in value && value.text) return String(value.text).trim();
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText
        .map((part) => part.text ?? '')
        .join('')
        .trim();
    }
  }
  return String(value).trim();
}

function walkSourceFiles(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkSourceFiles(full, acc);
    else if (
      entry.name.endsWith('.xlsx') &&
      !/READY|MERGE|Flagged/i.test(entry.name)
    ) {
      acc.push(full);
    }
  }
  return acc;
}

function sourceHeaderCols(sheet: ExcelJS.Worksheet, headerRow: number) {
  const map = new Map<string, number[]>();
  sheet.getRow(headerRow).eachCell((cell, col) => {
    const text = cellText(cell.value);
    if (!text) return;
    const list = map.get(text) ?? [];
    list.push(col);
    map.set(text, list);
  });
  return map;
}

function detectHeaderRow(sheet: ExcelJS.Worksheet): number {
  for (let row = 1; row <= 4; row += 1) {
    const headers = sourceHeaderCols(sheet, row);
    for (const header of headers.keys()) {
      const norm = normalizeOfficeHeader(header);
      if (norm === 'roll no' || norm === 'roll number') return row;
    }
  }
  return 2;
}

function collegeRollFromRow(
  row: ExcelJS.Row,
  headers: Map<string, number[]>,
): string {
  for (const [header, cols] of headers) {
    const norm = normalizeOfficeHeader(header);
    if (norm !== 'roll no' && norm !== 'roll number') continue;
    const text = cellText(row.getCell(cols[0]!).value)
      .replace(/\s+/g, '')
      .toUpperCase();
    if (/^[A-Z]{2}\d{2}-/.test(text)) return text;
  }
  return '';
}

type IdentityHit = {
  enrollment: string;
  nehuRoll: string;
  nehuReg: string;
  file: string;
};

async function collectFromExcel(): Promise<IdentityHit[]> {
  const hits: IdentityHit[] = [];
  const files = walkSourceFiles(sourceRoot);
  for (const file of files) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(file);
    for (const sheet of wb.worksheets) {
      const headerRow = detectHeaderRow(sheet);
      const headers = sourceHeaderCols(sheet, headerRow);
      const hasRoll = [...headers.keys()].some((header) => {
        const norm = normalizeOfficeHeader(header);
        return norm === 'roll no' || norm === 'roll number';
      });
      if (!hasRoll) continue;
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber <= headerRow) return;
        const enrollment = collegeRollFromRow(row, headers);
        if (!enrollment) return;
        const { nehuRoll, nehuReg } = readOfficeIdentity(
          row,
          headers,
          cellText,
          enrollment,
        );
        if (!nehuRoll && !nehuReg) return;
        hits.push({
          enrollment,
          nehuRoll,
          nehuReg,
          file: path.relative(sourceRoot, file),
        });
      });
    }
  }
  return hits;
}

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: tenantSlug, deletedAt: null },
    select: { id: true, slug: true },
  });
  if (!tenant) throw new Error(`Tenant not found: ${tenantSlug}`);

  const missingRolls = await prisma.student.count({
    where: { tenantId: tenant.id, deletedAt: null, rollNumber: null },
  });
  const missingNehu = await prisma.student.count({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      universityRollNumber: null,
    },
  });

  console.log(
    `\nBackfill imported rolls — tenant=${tenant.slug}` +
      `${apply ? '  (APPLYING)' : '  (DRY RUN — no writes)'}`,
  );
  console.log(`  Students missing college roll: ${missingRolls}`);
  console.log(`  Students missing NEHU roll:    ${missingNehu}`);
  console.log(`  Office Excel root: ${sourceRoot}`);

  const excelHits = await collectFromExcel();
  const byEnrollment = new Map<string, IdentityHit>();
  for (const hit of excelHits) {
    if (!byEnrollment.has(hit.enrollment))
      byEnrollment.set(hit.enrollment, hit);
  }
  console.log(
    `  Identity rows in office files: ${excelHits.length} (${byEnrollment.size} unique rolls)`,
  );

  const students = await prisma.student.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
    select: {
      id: true,
      enrollmentNumber: true,
      rollNumber: true,
      universityRollNumber: true,
      universityRegistrationNumber: true,
    },
  });
  const byEnroll = new Map(
    students.map((s) => [s.enrollmentNumber.trim().toUpperCase(), s]),
  );

  const rollUpdates: { id: string; rollNumber: string }[] = [];
  const nehuUpdates: {
    id: string;
    universityRollNumber?: string;
    universityRegistrationNumber?: string;
  }[] = [];
  let excelMatched = 0;
  let excelMissingStudent = 0;

  for (const student of students) {
    if (!student.rollNumber && student.enrollmentNumber.trim()) {
      rollUpdates.push({
        id: student.id,
        rollNumber: student.enrollmentNumber.trim(),
      });
    }
  }

  for (const hit of byEnrollment.values()) {
    const student = byEnroll.get(hit.enrollment);
    if (!student) {
      excelMissingStudent += 1;
      continue;
    }
    excelMatched += 1;
    const patch: (typeof nehuUpdates)[number] = { id: student.id };
    if (hit.nehuRoll && !student.universityRollNumber) {
      patch.universityRollNumber = hit.nehuRoll;
    }
    if (hit.nehuReg && !student.universityRegistrationNumber) {
      patch.universityRegistrationNumber = hit.nehuReg;
    }
    if (patch.universityRollNumber || patch.universityRegistrationNumber) {
      nehuUpdates.push(patch);
    }
  }

  console.log(`  College roll backfills: ${rollUpdates.length}`);
  console.log(`  NEHU field backfills:   ${nehuUpdates.length}`);
  console.log(
    `  Excel rolls matched to ERP: ${excelMatched}; unmatched Excel rolls: ${excelMissingStudent}`,
  );
  console.log('  Sample NEHU updates:');
  for (const row of nehuUpdates.slice(0, 5)) {
    const student = students.find((s) => s.id === row.id);
    console.log(
      `    ${(student?.enrollmentNumber ?? row.id).padEnd(12)} NEHU ${
        row.universityRollNumber ?? '-'
      }  Reg ${row.universityRegistrationNumber ?? '-'}`,
    );
  }

  if (!apply) {
    console.log('\nDRY RUN — no changes written. Re-run with --apply.\n');
    return;
  }

  let rollWritten = 0;
  for (let i = 0; i < rollUpdates.length; i += 200) {
    const chunk = rollUpdates.slice(i, i + 200);
    await prisma.$transaction(
      chunk.map((row) =>
        prisma.student.update({
          where: { id: row.id },
          data: { rollNumber: row.rollNumber },
        }),
      ),
    );
    rollWritten += chunk.length;
  }

  let nehuWritten = 0;
  for (let i = 0; i < nehuUpdates.length; i += 200) {
    const chunk = nehuUpdates.slice(i, i + 200);
    await prisma.$transaction(
      chunk.map((row) =>
        prisma.student.update({
          where: { id: row.id },
          data: {
            ...(row.universityRollNumber
              ? { universityRollNumber: row.universityRollNumber }
              : {}),
            ...(row.universityRegistrationNumber
              ? {
                  universityRegistrationNumber:
                    row.universityRegistrationNumber,
                }
              : {}),
          },
        }),
      ),
    );
    nehuWritten += chunk.length;
  }

  console.log(
    `\nWrote ${rollWritten} college roll(s) and ${nehuWritten} NEHU update(s).\n`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
