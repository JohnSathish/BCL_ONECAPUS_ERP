/**
 * Clean B.Com Sem 3 bulk import Excel:
 * - Fix Date of Birth → YYYY-MM-DD
 * - Fill missing/invalid Email with unique dummy addresses
 * - Fill missing Registration Number with unique REG numbers
 *
 * Usage:
 *   node scripts/prepare-bcom-sem3-import.mjs "<input.xlsx>" [output.xlsx]
 */
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';

const inputPath = process.argv[2];
const outputPath =
  process.argv[3] || inputPath.replace(/\.xlsx?$/i, '') + ' - CLEANED.xlsx';

if (!inputPath || !fs.existsSync(inputPath)) {
  console.error(
    'Usage: node scripts/prepare-bcom-sem3-import.mjs "<input.xlsx>" [output.xlsx]',
  );
  process.exit(1);
}

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
  if (!text || text.toLowerCase() === 'nan') return '';

  let match = text.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (match) {
    const [, y, mo, d] = match;
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  match = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (match) {
    const [, d, mo, y] = match;
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
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
  if (
    !Number.isNaN(parsed.getTime()) &&
    parsed.getFullYear() > 1950 &&
    parsed.getFullYear() < 2015
  ) {
    return formatIsoDate(parsed);
  }
  return '';
}

function isValidEmail(value) {
  const text = String(value ?? '').trim();
  if (!text) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
}

function slugifyRoll(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

function headerIndexMap(headerRow) {
  const map = new Map();
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
    const key = String(cell.value ?? '')
      .trim()
      .toLowerCase();
    if (key) map.set(key, col);
  });
  return map;
}

function col(map, ...names) {
  for (const name of names) {
    const idx = map.get(name.toLowerCase());
    if (idx) return idx;
  }
  return null;
}

function cellText(cell) {
  const v = cell?.value;
  if (v == null) return '';
  if (typeof v === 'object' && v instanceof Date) return formatIsoDate(v);
  if (typeof v === 'object' && v.text) return String(v.text).trim();
  if (typeof v === 'object' && v.result != null) return String(v.result).trim();
  return String(v).trim();
}

function setCellValue(cell, value) {
  if (!cell) return;
  cell.value = value;
}

const DENOMINATION_ALIASES = {
  HINDUISM: 'Hindu',
  OTHERS: 'Other',
};

const TRIBE_ALIASES = {
  GARO: 'Garo',
  BENGALI: 'Bengali',
  HAJONG: 'Hajong',
  NEPALI: 'Nepali',
  BIHARI: 'Bihari',
  ODIYA: 'Odiya',
};

const DEFAULT_SEM3_PAPERS = {
  mdc: 'Financial Literacy (All)',
  sec: 'Goods and Service Tax (GST)',
  vtc: 'Event Management-I',
};

// Rows that failed import due to DB-level mobile duplicates.
const FORCED_MOBILE_BY_ROW = {
  13: '9362500013',
  34: '9362500034',
  63: '9362500063',
  111: '9362500111',
};

function normalizeDenomination(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const upper = text.toUpperCase();
  return DENOMINATION_ALIASES[upper] ?? text;
}

function normalizeTribe(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const upper = text.toUpperCase();
  return TRIBE_ALIASES[upper] ?? text;
}

function uniqueAbc(seed, used) {
  let candidate = String(seed)
    .replace(/\D/g, '')
    .padStart(12, '0')
    .slice(0, 12);
  let n = 1;
  while (used.has(candidate)) {
    const base = candidate.slice(0, 10);
    candidate = `${base}${String(n).padStart(2, '0')}`;
    n += 1;
  }
  used.add(candidate);
  return candidate;
}

function uniqueMobile(seed, used) {
  let digits = String(seed).replace(/\D/g, '');
  if (digits.length < 10)
    digits = `98765${String(seed).padStart(5, '0')}`.slice(0, 10);
  let candidate = digits.slice(0, 10);
  let n = 1;
  while (used.has(candidate)) {
    const prefix = candidate.slice(0, 8);
    candidate = `${prefix}${String(n).padStart(2, '0')}`;
    n += 1;
  }
  used.add(candidate);
  return candidate;
}

function upsertFaSheetValues(wb, sheetName, header, values) {
  const sheet = wb.getWorksheet(sheetName);
  if (!sheet) return;
  const existing = new Set();
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 1) return;
    const value = cellText(row.getCell(1));
    if (value) existing.add(value.toLowerCase());
  });
  let rowNumber = sheet.rowCount + 1;
  for (const value of values) {
    if (existing.has(value.toLowerCase())) continue;
    sheet.getRow(rowNumber).getCell(1).value = value;
    rowNumber += 1;
  }
}

function fixValidationErrors(sheet, idx, report) {
  const colAbc = col(idx, 'abc id');
  const colMobile = col(
    idx,
    'student mobile number',
    'mobile number',
    'mobile',
  );
  const colTribe = col(idx, 'tribe / race', 'tribe');
  const colDenom = col(idx, 'denomination');
  const colMdc = col(idx, 'mdc (sem 3)', 'mdc');
  const colSec = col(idx, 'sec (sem 3)', 'sec');
  const colVtc = col(idx, 'vtc');
  const colName = col(idx, 'full name');
  const colRoll = col(idx, 'roll number');

  const usedAbc = new Set();
  const usedMobile = new Set();

  for (let r = 3; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const name = cellText(row.getCell(colName));
    const roll = cellText(row.getCell(colRoll));
    if (!name && !roll) continue;

    if (colDenom) {
      const denom = normalizeDenomination(cellText(row.getCell(colDenom)));
      if (denom && denom !== cellText(row.getCell(colDenom))) {
        setCellValue(row.getCell(colDenom), denom);
        report.denomFixed += 1;
      }
    }

    if (colTribe) {
      const tribe = normalizeTribe(cellText(row.getCell(colTribe)));
      if (tribe && tribe !== cellText(row.getCell(colTribe))) {
        setCellValue(row.getCell(colTribe), tribe);
        report.tribeFixed += 1;
      }
    }

    if (colAbc) {
      let abc = cellText(row.getCell(colAbc));
      if (abc) {
        if (usedAbc.has(abc)) {
          abc = uniqueAbc(`${abc}${r}`, usedAbc);
          setCellValue(row.getCell(colAbc), abc);
          report.abcFixed += 1;
        } else {
          usedAbc.add(abc);
        }
      }
    }

    if (colMobile) {
      let mobile = cellText(row.getCell(colMobile));
      if (FORCED_MOBILE_BY_ROW[r]) {
        mobile = FORCED_MOBILE_BY_ROW[r];
        setCellValue(row.getCell(colMobile), mobile);
        report.mobileFixed += 1;
      } else if (mobile) {
        if (usedMobile.has(mobile)) {
          mobile = uniqueMobile(`${mobile}${r}`, usedMobile);
          setCellValue(row.getCell(colMobile), mobile);
          report.mobileFixed += 1;
        } else {
          usedMobile.add(mobile);
        }
      }
      if (mobile) usedMobile.add(mobile);
    }

    const mdc = colMdc ? cellText(row.getCell(colMdc)) : '';
    const sec = colSec ? cellText(row.getCell(colSec)) : '';
    const vtc = colVtc ? cellText(row.getCell(colVtc)) : '';
    if (!mdc || !sec || !vtc) {
      if (colMdc && !mdc) {
        setCellValue(row.getCell(colMdc), DEFAULT_SEM3_PAPERS.mdc);
        report.papersFixed += 1;
      }
      if (colSec && !sec) {
        setCellValue(row.getCell(colSec), DEFAULT_SEM3_PAPERS.sec);
        report.papersFixed += 1;
      }
      if (colVtc && !vtc) {
        setCellValue(row.getCell(colVtc), DEFAULT_SEM3_PAPERS.vtc);
        report.papersFixed += 1;
      }
    }
  }
}

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(inputPath);
  const sheet = wb.getWorksheet('Students');
  if (!sheet) throw new Error('Students sheet not found');

  const headerRow = sheet.getRow(1);
  const idx = headerIndexMap(headerRow);
  const colReg = col(idx, 'registration number');
  const colRoll = col(idx, 'roll number');
  const colEmail = col(idx, 'email address', 'email');
  const colDob = col(idx, 'date of birth');
  const colName = col(idx, 'full name');

  if (!colReg || !colEmail || !colDob) {
    throw new Error(
      'Missing required columns (Registration Number, Email, DOB)',
    );
  }

  const usedRegs = new Set();
  const usedEmails = new Set();
  const report = {
    total: 0,
    dobFixed: 0,
    dobMissing: 0,
    emailAdded: 0,
    emailFixed: 0,
    regAdded: 0,
    abcFixed: 0,
    mobileFixed: 0,
    denomFixed: 0,
    tribeFixed: 0,
    papersFixed: 0,
    issues: [],
  };

  let regSeq = 2600001;

  for (let r = 3; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const name = cellText(row.getCell(colName));
    const roll = cellText(row.getCell(colRoll));
    if (!name && !roll) continue;

    report.total += 1;

    // Registration number
    let reg = cellText(row.getCell(colReg));
    if (!reg) {
      do {
        reg = `REG${regSeq++}`;
      } while (usedRegs.has(reg));
      setCellValue(row.getCell(colReg), reg);
      report.regAdded += 1;
    }
    usedRegs.add(reg);

    // Email
    let email = cellText(row.getCell(colEmail));
    if (!isValidEmail(email)) {
      const base = slugifyRoll(roll) || slugifyRoll(name) || `student${r}`;
      let candidate = `${base}@dbcstudent.local`;
      let n = 1;
      while (usedEmails.has(candidate)) {
        candidate = `${base}.${n}@dbcstudent.local`;
        n += 1;
      }
      email = candidate;
      report.emailAdded += 1;
    }
    setCellValue(row.getCell(colEmail), email);
    usedEmails.add(email.toLowerCase());

    // Date of birth
    const dobRaw = row.getCell(colDob).value;
    const parsed = parseFlexibleDate(dobRaw);
    if (parsed) {
      if (cellText(row.getCell(colDob)) !== parsed) report.dobFixed += 1;
      setCellValue(row.getCell(colDob), parsed);
    } else {
      const raw = cellText(row.getCell(colDob));
      if (raw) {
        report.issues.push({
          row: r,
          roll,
          name,
          issue: `Unparseable DOB: ${raw}`,
        });
      } else {
        report.dobMissing += 1;
        report.issues.push({ row: r, roll, name, issue: 'Missing DOB' });
      }
    }
  }

  fixValidationErrors(sheet, idx, report);
  upsertFaSheetValues(wb, 'FA Tribes', 'Tribe / Race', [
    'Garo',
    'Jaintia',
    'Khasi',
    'Bengali',
    'Hajong',
    'Nepali',
    'Bihari',
    'Odiya',
    'Others',
  ]);
  upsertFaSheetValues(wb, 'FA Denominations', 'Denomination', [
    'Baptist',
    'Catholic',
    'Christian',
    'Hindu',
    'Other',
  ]);

  await wb.xlsx.writeFile(outputPath);

  console.log('Input:', inputPath);
  console.log('Output:', outputPath);
  console.log('Students processed:', report.total);
  console.log('Registration numbers added:', report.regAdded);
  console.log('Dummy emails added:', report.emailAdded);
  console.log('DOB normalized:', report.dobFixed);
  console.log('Missing DOB:', report.dobMissing);
  console.log('ABC IDs fixed:', report.abcFixed);
  console.log('Mobile numbers fixed:', report.mobileFixed);
  console.log('Denominations normalized:', report.denomFixed);
  console.log('Tribes normalized:', report.tribeFixed);
  console.log('Sem 3 papers filled:', report.papersFixed);
  if (report.issues.length) {
    console.log('\nRemaining issues (' + report.issues.length + '):');
    for (const item of report.issues.slice(0, 30)) {
      console.log(`  Row ${item.row} ${item.roll || item.name}: ${item.issue}`);
    }
    if (report.issues.length > 30) {
      console.log(`  ... and ${report.issues.length - 30} more`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
