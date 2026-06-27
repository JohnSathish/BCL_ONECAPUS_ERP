/**
 * Build a Bulk Update CSV for Date of Birth from Excel (.xlsx or .xls).
 *
 * Usage:
 *   node scripts/prepare-bulk-update-dob-csv.mjs "<input.xlsx|.xls>" [output.csv]
 *   node scripts/prepare-bulk-update-dob-csv.mjs "<dob-source.xls>" --merge "<student.xlsx>"
 *
 * Upload the CSV in Admin → Students → Bulk Update → Individual CSV mode.
 */
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

function formatIsoDate(value) {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseFlexibleDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatIsoDate(value);
  }
  const text = String(value ?? '').trim();
  if (!text) return '';

  let match = text.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (match) {
    const [, y, mo, d] = match;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) {
    const [, d, mo, y] = match;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  match = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (match) {
    const [, d, mo, y] = match;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (match) {
    const [, mo, d, yy] = match;
    const year = Number(yy) > 30 ? 1900 + Number(yy) : 2000 + Number(yy);
    return `${year}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  const serial = Number(text);
  if (Number.isFinite(serial) && serial > 10000 && serial < 60000) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    const parsed = new Date(excelEpoch + serial * 86_400_000);
    if (!Number.isNaN(parsed.getTime())) return formatIsoDate(parsed);
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return formatIsoDate(parsed);
  return '';
}

function headerKey(header) {
  return String(header ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\.$/, '');
}

function findColumnIndex(headers, aliases, { exactOnly = false } = {}) {
  const normalized = headers.map(headerKey);
  for (const alias of aliases) {
    const key = alias.toLowerCase();
    const idx = normalized.indexOf(key);
    if (idx >= 0) return idx;
  }
  if (exactOnly) return -1;
  for (let i = 0; i < normalized.length; i += 1) {
    if (aliases.some((alias) => normalized[i] === alias.toLowerCase()))
      return i;
  }
  return -1;
}

async function readSheetRows(resolvedInput) {
  const ext = path.extname(resolvedInput).toLowerCase();
  if (ext === '.xls') {
    let XLSX;
    try {
      XLSX = require('xlsx');
    } catch {
      throw new Error(
        'Reading .xls requires the xlsx package. Run: npm install xlsx -w api',
      );
    }
    const workbook = XLSX.readFile(resolvedInput, { cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      raw: false,
    });
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(resolvedInput);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('No worksheet found');

  const matrix = [];
  sheet.eachRow((row, rowNumber) => {
    const cells = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const value = cell.value;
      if (value instanceof Date) cells[colNumber - 1] = formatIsoDate(value);
      else if (value && typeof value === 'object' && value.result != null) {
        cells[colNumber - 1] = String(value.result).trim();
      } else cells[colNumber - 1] = value == null ? '' : String(value).trim();
    });
    matrix[rowNumber - 1] = cells;
  });
  return matrix;
}

function extractDobRows(matrix) {
  const headers = (matrix[0] ?? []).map((h) => String(h ?? '').trim());
  const rollIdx = findColumnIndex(headers, [
    'roll no',
    'roll number',
    'college roll no',
    'college roll number',
  ]);
  const regIdx = findColumnIndex(headers, [
    'registration number',
    'enrollment number',
    'reg no',
    'nehu regd. no',
    'nehu registration number',
  ]);
  const dobIdx = findColumnIndex(
    headers,
    ['date of birth', 'dob', 'birth date'],
    { exactOnly: true },
  );

  if (dobIdx < 0) throw new Error('Could not find a Date of Birth column');
  if (rollIdx < 0 && regIdx < 0) {
    throw new Error('Could not find Roll Number or Registration Number column');
  }

  const rows = [];
  let skipped = 0;
  const invalid = [];

  for (let i = 1; i < matrix.length; i += 1) {
    const line = matrix[i] ?? [];
    const roll = rollIdx >= 0 ? String(line[rollIdx] ?? '').trim() : '';
    const enrollment = regIdx >= 0 ? String(line[regIdx] ?? '').trim() : '';
    const dobRaw = line[dobIdx];
    const dateOfBirth = parseFlexibleDate(dobRaw);

    if (!roll && !enrollment) {
      skipped += 1;
      continue;
    }
    if (!dateOfBirth) {
      skipped += 1;
      if (roll || enrollment) {
        invalid.push({ roll: roll || enrollment, raw: String(dobRaw ?? '') });
      }
      continue;
    }

    rows.push({ RollNumber: roll, EnrollmentNumber: enrollment, dateOfBirth });
  }

  return { rows, skipped, invalid, headers, rollIdx, regIdx, dobIdx };
}

async function mergeIntoStudentExcel(dobMap, studentExcelPath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(studentExcelPath);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('No worksheet in merge target');

  const headerRow = sheet.getRow(1);
  const headers = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value ?? '').trim();
  });

  const rollIdx = findColumnIndex(headers, ['roll number']);
  const dobIdx = findColumnIndex(headers, ['date of birth'], {
    exactOnly: true,
  });
  if (rollIdx < 0 || dobIdx < 0) {
    throw new Error(
      'Merge target must have Roll Number and Date of Birth columns',
    );
  }

  let updated = 0;
  let notFound = 0;
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 2) return;
    const roll = String(row.getCell(rollIdx + 1).value ?? '').trim();
    if (!roll || !roll.startsWith('BA')) return;
    const dob = dobMap.get(roll.toUpperCase());
    if (!dob) {
      notFound += 1;
      return;
    }
    row.getCell(dobIdx + 1).value = dob;
    updated += 1;
  });

  const outPath = studentExcelPath.replace(/\.xlsx$/i, ' - WITH DOB.xlsx');
  await workbook.xlsx.writeFile(outPath);
  return { outPath, updated, notFound };
}

async function main() {
  const args = process.argv.slice(2);
  const mergeIdx = args.indexOf('--merge');
  const mergeTarget = mergeIdx >= 0 ? args[mergeIdx + 1] : null;
  const positional = args.filter(
    (a, i) => i !== mergeIdx && i !== mergeIdx + 1,
  );

  const inputPath = positional[0];
  if (!inputPath) {
    console.error(
      'Usage: node scripts/prepare-bulk-update-dob-csv.mjs <input.xlsx|.xls> [output.csv] [--merge student.xlsx]',
    );
    process.exit(1);
  }

  const resolvedInput = path.resolve(inputPath);
  const outputPath =
    positional[1] ??
    path.join(
      path.dirname(resolvedInput),
      `${path.basename(resolvedInput, path.extname(resolvedInput))}-DOB-BULK-UPDATE.csv`,
    );

  const matrix = await readSheetRows(resolvedInput);
  const { rows, skipped, invalid } = extractDobRows(matrix);

  const lines = ['RollNumber,EnrollmentNumber,dateOfBirth'];
  for (const row of rows) {
    lines.push(
      [row.RollNumber, row.EnrollmentNumber, row.dateOfBirth]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );
  }

  fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');
  console.log(`Wrote ${rows.length} rows to ${outputPath}`);
  if (skipped > 0) {
    console.log(`Skipped ${skipped} rows (missing roll/reg or invalid DOB)`);
  }
  if (invalid.length > 0) {
    console.log('Could not parse DOB for:');
    invalid.slice(0, 10).forEach((x) => console.log(`  ${x.roll}: "${x.raw}"`));
    if (invalid.length > 10)
      console.log(`  ... and ${invalid.length - 10} more`);
  }

  if (mergeTarget) {
    const dobMap = new Map(
      rows.map((r) => [r.RollNumber.toUpperCase(), r.dateOfBirth]),
    );
    const merged = await mergeIntoStudentExcel(
      dobMap,
      path.resolve(mergeTarget),
    );
    console.log(
      `Merged DOB into ${merged.outPath} (${merged.updated} updated, ${merged.notFound} rolls not in source)`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
