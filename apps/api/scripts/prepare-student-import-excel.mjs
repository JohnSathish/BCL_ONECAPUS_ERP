/**
 * Normalize a student bulk-import Excel file to ERP-ready format.
 * Usage: node scripts/prepare-student-import-excel.mjs <input.xlsx> [output.xlsx]
 */
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';

const ERP_HEADERS = [
  'Academic Year',
  'Admission Date',
  'Admission Status',
  'Admission Number',
  'Application Number',
  'Form Number',
  'Registration Number',
  'Roll Number',
  'University Roll Number',
  'University Registration Number',
  'ABC ID',
  'Shift',
  'Programme',
  'Department',
  'Admission Batch',
  'Stream',
  'Semester',
  'Full Name',
  'Gender',
  'Date of Birth',
  'Blood Group',
  'Category',
  'Tribe / Race',
  'Religion',
  'Denomination',
  'Nationality',
  'Aadhaar Number',
  'Email Address',
  'Student Mobile Number',
  'WhatsApp Number',
  'Photo File Name',
  "Father's Name",
  "Father's Mobile",
  "Father's Occupation",
  "Mother's Name",
  "Mother's Mobile",
  "Mother's Occupation",
  'Guardian Name',
  'Guardian Mobile',
  'Present Address',
  'Present Village / Town',
  'Present Police Station',
  'Present District',
  'Present State',
  'Present PIN Code',
  'Permanent Address',
  'Permanent Village / Town',
  'Permanent District',
  'Permanent State',
  'Permanent PIN Code',
  'Institution Last Attended',
  'Board / University',
  'Registration / Private',
  'Year of Passing',
  'Total Marks',
  'Percentage',
  'Division',
  'CUET Marks',
  'CUET Roll Number',
  'Major Department',
  'Minor Department',
  'MDC',
  'AEC',
  'SEC',
  'Major Department (Sem 3)',
  'Second Major Department',
  'MDC (Sem 3)',
  'AEC (Sem 3)',
  'SEC (Sem 3)',
  'VTC',
  'Major Department (Sem 5)',
  'Minor Department (Sem 5)',
  'Internship Subject',
  'RFID Number',
  'Library Card Number',
  'Hostel',
  'Transport',
  'Scholarship Category',
  'Student Status',
  'Section Code',
];

const ERP_HELPERS = {
  'Academic Year': 'e.g. 2026-27 — must match admission batch entry session',
  'Admission Date': 'YYYY-MM-DD',
  'Admission Status': 'ACTIVE, PROVISIONAL, CANCELLED',
  'Registration Number': 'College registration number (required)',
  'ABC ID': '12-digit Academic Bank of Credits ID',
  Department: 'Department code — optional if Major Department is set',
  Semester: '1, 3, or 5 for subject columns below',
  Gender: 'Male, Female, Other',
  'Date of Birth': 'YYYY-MM-DD',
  Category: 'ST, SC, OBC, GENERAL, EWS',
  Religion: 'Christian, Hindu, Muslim, Other, Buddhist',
  Denomination: 'Baptist, Catholic, Christian, Other, Hindu',
  'Blood Group': 'A+, A−, B+, B−, O+, O−, AB+, AB−',
  'Photo File Name': 'Optional — match filename in photo bulk upload folder',
};

function normalizeCell(value) {
  if (value == null) return '';
  if (typeof value !== 'object') return value;
  if (value instanceof Date) return formatDate(value);
  if (value.result != null && value.result !== value) {
    return normalizeCell(value.result);
  }
  if (value.text != null && value.text !== '') {
    return String(value.text).trim();
  }
  if (Array.isArray(value.richText)) {
    return value.richText
      .map((part) => part.text ?? '')
      .join('')
      .trim();
  }
  if (value.formula != null) {
    return value.result != null ? normalizeCell(value.result) : '';
  }
  return String(value).trim();
}

function formatDate(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return '';
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function asPlainString(value) {
  const normalized = normalizeCell(value);
  if (normalized instanceof Date) return formatDate(normalized);
  if (typeof normalized === 'number' && Number.isFinite(normalized)) {
    return String(normalized);
  }
  return String(normalized ?? '').trim();
}

function fixDateOfBirth(value) {
  const text = asPlainString(value);
  if (!text) return '';
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return text;
  let year = Number(match[1]);
  const month = match[2];
  const day = match[3];
  if (year > 2015 && year >= 2200) {
    year -= 200;
  } else if (year > 2015) {
    year -= 100;
  }
  if (year < 1950 || year > 2015) return text;
  return `${year}-${month}-${day}`;
}

const PROGRAMME_SEM3_MAJOR = {
  'BA-GEO': 'Geography',
  'BA-ECO': 'Economics',
  'BA-ENG': 'English',
  'BA-SOC': 'Sociology',
  'BA-EDU': 'Education',
  'BA-GAR': 'Garo',
  'BA-HIS': 'History',
  'BA-PHI': 'Philosophy',
  'BA-POL': 'Political Science',
};

function normalizeReligion(value) {
  const upper = String(value ?? '')
    .trim()
    .toUpperCase();
  const aliases = {
    CHRISTISN: 'Christian',
    CHRISTIAN: 'Christian',
    HINDUISM: 'Hindu',
    HINDU: 'Hindu',
    BUDDHISM: 'Buddhist',
    MUSLIM: 'Muslim',
    OTHER: 'Other',
  };
  return aliases[upper] ?? String(value ?? '').trim();
}

function normalizeDenomination(value) {
  const upper = String(value ?? '')
    .trim()
    .toUpperCase();
  const aliases = {
    BAPTIST: 'Baptist',
    CATHOLIC: 'Catholic',
    CHRISTIAN: 'Christian',
    OTHER: 'Other',
    OTHERS: 'Other',
    HINDU: 'Hindu',
  };
  return aliases[upper] ?? String(value ?? '').trim();
}

function normalizeBloodGroup(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const upper = text.toUpperCase();
  if (['NOT CHECKED', 'NA', 'N/A', 'UNKNOWN', 'NIL'].includes(upper)) {
    return '';
  }
  if (upper === '0+' || upper === '0 POS' || upper === '0POS') return 'O+';
  if (/^O\+VE$/i.test(text)) return 'O+';
  if (/^A\+VE$/i.test(text)) return 'A+';
  if (/^B\+VE$/i.test(text)) return 'B+';
  if (/^AB\+VE$/i.test(text)) return 'AB+';
  if (/^(A|B|O|AB)$/i.test(text)) return `${upper}+`;
  if (/^(A|B|O|AB)[+-]$/i.test(text)) {
    const group = text.slice(0, -1).toUpperCase();
    return text.endsWith('-') ? `${group}\u2212` : `${group}+`;
  }
  return text.trim();
}

function isPlaceholderRegistration(value) {
  return /^REG2026\d+$/i.test(String(value ?? '').trim());
}

function readSourceRows(sheet) {
  const sourceHeaders = sheet
    .getRow(1)
    .values.slice(1)
    .map((v) => String(v ?? '').trim());
  const headerIndex = new Map(sourceHeaders.map((h, i) => [h, i]));
  const rows = [];

  for (let rowNumber = 3; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const excelRow = sheet.getRow(rowNumber);
    const record = {};
    for (const header of ERP_HEADERS) {
      const index = headerIndex.get(header);
      record[header] =
        index == null ? '' : asPlainString(excelRow.getCell(index + 1).value);
    }
    const hasData = ERP_HEADERS.some((header) => record[header]);
    if (hasData) {
      rows.push({ rowNumber, record });
    }
  }

  return rows;
}

function applyRowFixes(record, notes) {
  const reg = record['Registration Number'];
  const roll = record['Roll Number'];
  if (isPlaceholderRegistration(reg) && roll) {
    if (!record['Application Number']) {
      record['Application Number'] = reg;
    }
    record['Registration Number'] = roll;
    notes.push(
      `Registration Number set to Roll Number (${roll}) instead of placeholder ${reg}`,
    );
  }

  record['Email Address'] = record['Email Address'].trim().toLowerCase();
  record['Date of Birth'] = fixDateOfBirth(record['Date of Birth']);
  record.Religion = normalizeReligion(record.Religion);
  record.Denomination = normalizeDenomination(record.Denomination);
  record['Blood Group'] = normalizeBloodGroup(record['Blood Group']);

  const programme = record.Programme.trim().toUpperCase();
  if (programme) record.Programme = programme;
  const semester = record.Semester.replace(/[^\d]/g, '');
  if (semester === '3') {
    const majorKey = 'Major Department (Sem 3)';
    const major = record[majorKey].trim();
    const tribe = record['Tribe / Race'].trim();
    const expectedMajor = PROGRAMME_SEM3_MAJOR[programme];
    if (
      expectedMajor &&
      (!major ||
        /^garo$/i.test(major) ||
        (tribe && major.toLowerCase() === tribe.toLowerCase()))
    ) {
      if (major !== expectedMajor) {
        notes.push(
          `Major Department (Sem 3) set to ${expectedMajor} for ${programme} (was "${major || 'empty'}")`,
        );
      }
      record[majorKey] = expectedMajor;
    }
  }
  if (semester) record.Semester = semester;

  record.Gender = record.Gender.trim();
  if (/^m$/i.test(record.Gender) || /^male$/i.test(record.Gender)) {
    record.Gender = 'Male';
  } else if (/^f$/i.test(record.Gender) || /^female$/i.test(record.Gender)) {
    record.Gender = 'Female';
  } else if (/^o$/i.test(record.Gender) || /^other$/i.test(record.Gender)) {
    record.Gender = 'Other';
  }

  for (const key of [
    'Shift',
    'Programme',
    'Department',
    'Admission Batch',
    'Stream',
    'Category',
    'Student Status',
  ]) {
    if (record[key]) record[key] = record[key].toUpperCase();
  }

  return record;
}

function dedupeMobiles(rows, notes) {
  const seen = new Map();
  for (const { rowNumber, record } of rows) {
    const mobile = record['Student Mobile Number'];
    if (!mobile) continue;
    if (seen.has(mobile)) {
      record['Student Mobile Number'] = '';
      notes.push(
        `Row ${rowNumber}: cleared duplicate mobile ${mobile} (first used on row ${seen.get(mobile)})`,
      );
    } else {
      seen.set(mobile, rowNumber);
    }
  }
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error(
      'Usage: node scripts/prepare-student-import-excel.mjs <input.xlsx> [output.xlsx]',
    );
    process.exit(1);
  }

  const outputPath =
    process.argv[3] ??
    path.join(
      path.dirname(inputPath),
      `${path.basename(inputPath, path.extname(inputPath))} - READY TO IMPORT.xlsx`,
    );

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(inputPath);
  const sourceSheet =
    workbook.getWorksheet('Students') ?? workbook.worksheets[0];
  if (!sourceSheet) {
    throw new Error('No worksheet found in source file');
  }

  const fixNotes = [];
  const rows = readSourceRows(sourceSheet).map(({ rowNumber, record }) => ({
    rowNumber,
    record: applyRowFixes(record, fixNotes),
  }));
  dedupeMobiles(rows, fixNotes);

  const out = new ExcelJS.Workbook();
  const students = out.addWorksheet('Students');
  students.addRow(ERP_HEADERS);
  students.addRow(
    ERP_HEADERS.map(
      (header) =>
        ERP_HELPERS[header] ??
        'Optional — stored in student profile when supported',
    ),
  );
  for (const { record } of rows) {
    students.addRow(ERP_HEADERS.map((header) => record[header] ?? ''));
  }

  students.getRow(1).font = { bold: true };
  students.getRow(2).font = { italic: true, color: { argb: 'FF666666' } };
  students.views = [{ state: 'frozen', ySplit: 2 }];
  students.columns.forEach((col) => {
    col.width = 24;
  });

  const notesSheet = out.addWorksheet('Import Fix Notes');
  notesSheet.addRow(['Prepared for ERP student bulk import']);
  notesSheet.addRow(['Source file', inputPath]);
  notesSheet.addRow(['Generated at', new Date().toISOString()]);
  notesSheet.addRow([]);
  notesSheet.addRow(['Summary']);
  notesSheet.addRow(['Student rows', rows.length]);
  notesSheet.addRow([
    'Registration numbers',
    'Placeholder REG2026xxx values replaced with Roll Number (BA25-xxx)',
  ]);
  notesSheet.addRow([
    'Email cells',
    'Converted from Excel hyperlinks to plain text',
  ]);
  notesSheet.addRow([
    'Duplicate mobiles',
    'Later duplicate Student Mobile Number values cleared (field is optional)',
  ]);
  notesSheet.addRow([]);
  notesSheet.addRow(['Detailed fixes']);
  for (const note of fixNotes.slice(0, 500)) {
    notesSheet.addRow([note]);
  }
  if (fixNotes.length > 500) {
    notesSheet.addRow([`... and ${fixNotes.length - 500} more similar fixes`]);
  }

  await out.xlsx.writeFile(outputPath);
  console.log(`Wrote ${rows.length} student rows to:\n${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
