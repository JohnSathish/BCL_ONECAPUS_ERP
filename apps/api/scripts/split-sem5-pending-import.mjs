import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';

const src =
  'C:/Users/johnm/OneDrive/Desktop/Import Live 1-3-5/Morning Shift/5th Semester/5th Sem Morning Shift Final Import02 - READY TO IMPORT.xlsx';
const outDir = path.dirname(src);
const excludeRows = new Set([
  100, 309, 315, 321, 345, 360, 362, 364, 365, 384, 391,
]);

function cellValue(value) {
  if (value == null) return '';
  if (value instanceof Date) return value;
  if (typeof value === 'object') {
    if (value.text) return value.text;
    if (value.result != null) return value.result;
  }
  return value;
}

async function writeBook(workbook, name, sheetName, headers, helper, rows) {
  const out = new ExcelJS.Workbook();
  const sheet = out.addWorksheet(sheetName);
  sheet.addRow(headers);
  sheet.addRow(helper);
  for (const record of rows) {
    sheet.addRow(headers.map((header) => record[header] ?? ''));
  }
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(2).font = { italic: true, color: { argb: 'FF666666' } };
  sheet.views = [{ state: 'frozen', ySplit: 2 }];
  sheet.columns.forEach((col) => {
    col.width = 24;
  });

  for (const sourceSheet of workbook.worksheets) {
    if (sourceSheet.name === sheetName) continue;
    const copy = out.addWorksheet(sourceSheet.name);
    sourceSheet.eachRow((row, rowNumber) => {
      copy.getRow(rowNumber).values = row.values;
    });
    if (sourceSheet.state) copy.state = sourceSheet.state;
  }

  const outputPath = path.join(outDir, name);
  await out.xlsx.writeFile(outputPath);
  return outputPath;
}

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(src);
const sheet = workbook.getWorksheet('Students');
const rawHeaders = (sheet.getRow(1).values ?? [])
  .slice(1)
  .map((v) => String(v ?? '').trim());
const rawHelper = (sheet.getRow(2).values ?? [])
  .slice(1)
  .map((v) => String(v ?? ''));
const headers = [];
const helper = [];
for (let index = 0; index < rawHeaders.length; index += 1) {
  const header = rawHeaders[index];
  if (!header) continue;
  headers.push(header);
  helper.push(rawHelper[index] ?? '');
}

const kept = [];
const excluded = [];

for (let rowNumber = 3; rowNumber <= sheet.rowCount; rowNumber += 1) {
  const row = sheet.getRow(rowNumber);
  const rawValues = (row.values ?? []).slice(1).map(cellValue);
  const values = [];
  for (let index = 0; index < rawHeaders.length; index += 1) {
    if (!rawHeaders[index]) continue;
    values.push(rawValues[index] ?? '');
  }
  const hasData = values.some((value) => String(value).trim());
  if (!hasData) continue;

  const record = Object.fromEntries(
    headers.map((header, index) => [header, values[index]]),
  );
  if (excludeRows.has(rowNumber)) {
    excluded.push({ rowNumber, record });
  } else {
    kept.push(record);
  }
}

const importPath = await writeBook(
  workbook,
  '5th Sem Morning Shift Final Import02 - READY TO IMPORT (382 students).xlsx',
  'Students',
  headers,
  helper,
  kept,
);
const pendingPath = await writeBook(
  workbook,
  '5th Sem Morning Shift Final Import02 - PENDING 11 students.xlsx',
  'Students',
  headers,
  helper,
  excluded.map((entry) => entry.record),
);

const reportPath = path.join(
  outDir,
  '5th Sem Morning Shift Final Import02 - EXCLUDED 11 REPORT.txt',
);
const report = [
  'Excluded 11 students pending minor verification',
  '='.repeat(50),
  '',
  ...excluded.map(
    (entry) =>
      `Row ${entry.rowNumber} | ${entry.record['Roll Number']} | ${entry.record['Full Name']} | Major: ${entry.record['Major Department (Sem 5)']} | Minor: ${entry.record['Minor Department (Sem 5)']}`,
  ),
  '',
  `Ready to import now: ${kept.length} students`,
  `Pending later: ${excluded.length} students`,
];
fs.writeFileSync(reportPath, report.join('\n'), 'utf8');

console.log(`Import file: ${importPath}`);
console.log(`Pending file: ${pendingPath}`);
console.log(`Report: ${reportPath}`);
console.log(`Kept: ${kept.length}, Excluded: ${excluded.length}`);
