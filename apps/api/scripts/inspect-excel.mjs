import ExcelJS from 'exceljs';

const path = process.argv[2];
if (!path) {
  console.error('Usage: node inspect-excel.mjs <path>');
  process.exit(1);
}

function cellText(value) {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if ('result' in value && value.result != null)
      return cellText(value.result);
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

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(path);
const sheet = wb.getWorksheet('Students') ?? wb.worksheets[0];
console.log('Sheet:', sheet.name, 'rows:', sheet.rowCount);
const headers = new Map();
sheet.getRow(1).eachCell((cell, col) => {
  const text = cellText(cell.value);
  if (text) headers.set(text, col);
});
console.log('Headers count:', headers.size);
for (const h of [
  'Full Name',
  'Roll Number',
  'Registration Number',
  'Major Department (Sem 5)',
  'Minor Department (Sem 5)',
  'Internship Subject',
  'Shift',
  'Programme',
  'Date of Birth',
  'Email Address',
  'Department',
  'Admission Date',
]) {
  console.log(`${h}: col ${headers.get(h) ?? 'missing'}`);
}

let dataRows = 0;
const majors = new Map();
const minors = new Map();
for (let rowNumber = 3; rowNumber <= sheet.rowCount; rowNumber += 1) {
  const row = sheet.getRow(rowNumber);
  const fullName = cellText(row.getCell(headers.get('Full Name')).value);
  const roll = cellText(row.getCell(headers.get('Roll Number')).value);
  if (!fullName && !roll) continue;
  dataRows += 1;
  const majorCol = headers.get('Major Department (Sem 5)');
  const minorCol = headers.get('Minor Department (Sem 5)');
  const major = majorCol ? cellText(row.getCell(majorCol).value) : '';
  const minor = minorCol ? cellText(row.getCell(minorCol).value) : '';
  if (major) majors.set(major, (majors.get(major) ?? 0) + 1);
  if (minor) minors.set(minor, (minors.get(minor) ?? 0) + 1);
  if (dataRows <= 3) {
    console.log(`Row ${rowNumber}:`, {
      fullName,
      roll,
      reg: cellText(row.getCell(headers.get('Registration Number')).value),
      major: majorCol ? cellText(row.getCell(majorCol).value) : '',
      minor: minorCol ? cellText(row.getCell(minorCol).value) : '',
      internship: headers.get('Internship Subject')
        ? cellText(row.getCell(headers.get('Internship Subject')).value)
        : '',
      shift: headers.get('Shift')
        ? cellText(row.getCell(headers.get('Shift')).value)
        : '',
      programme: headers.get('Programme')
        ? cellText(row.getCell(headers.get('Programme')).value)
        : '',
      dob: cellText(row.getCell(headers.get('Date of Birth')).value),
      email: cellText(row.getCell(headers.get('Email Address')).value),
    });
  }
}
console.log('Data rows:', dataRows);
console.log('Majors:', Object.fromEntries(majors));
console.log('Minors:', Object.fromEntries(minors));
