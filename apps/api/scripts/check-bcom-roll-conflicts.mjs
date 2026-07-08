import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const path =
  'C:/Users/johnm/OneDrive/Desktop/Import Live 1-3-5/V SEM/B.Com 5 Semester students Bulk Import - READY TO IMPORT.xlsx';

function cellText(value) {
  if (value == null) return '';
  return String(value).trim();
}

const prisma = new PrismaClient();
const tenant =
  (await prisma.tenant.findFirst({ where: { slug: 'demo' } })) ??
  (await prisma.tenant.findFirst({
    where: { name: { contains: 'Don Bosco' } },
  }));

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(path);
const sheet = wb.worksheets[0];
const headers = new Map();
sheet.getRow(1).eachCell((cell, col) => {
  const text = cellText(cell.value);
  if (text) headers.set(text, col);
});

const rolls = [];
for (let rowNumber = 3; rowNumber <= sheet.rowCount; rowNumber += 1) {
  const row = sheet.getRow(rowNumber);
  const roll = cellText(row.getCell(headers.get('Roll Number')).value);
  const name = cellText(row.getCell(headers.get('Full Name')).value);
  if (roll || name) rolls.push({ roll: roll.toUpperCase(), name });
}

const existing = await prisma.student.findMany({
  where: {
    tenantId: tenant.id,
    deletedAt: null,
    rollNumber: { in: rolls.map((r) => r.roll).filter(Boolean) },
  },
  select: { rollNumber: true, enrollmentNumber: true },
});

console.log('Rows in file:', rolls.length);
console.log('Roll conflicts in DB:', existing.length);
for (const row of existing) {
  console.log(' -', row.rollNumber, row.enrollmentNumber);
}

await prisma.$disconnect();
