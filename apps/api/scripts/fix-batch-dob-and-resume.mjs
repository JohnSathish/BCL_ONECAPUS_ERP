import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const batchId = process.argv[2];
if (!batchId) {
  console.error('Usage: node scripts/fix-batch-dob-and-resume.mjs <batchId>');
  process.exit(1);
}

const prisma = new PrismaClient();

function fixDob(value) {
  if (!value) return value;
  const text = String(value).trim();
  const match = text.match(/^(\d{4,})-(\d{2})-(\d{2})$/);
  if (!match) return text;
  let year = Number(match[1]);
  const month = match[2];
  const day = match[3];
  if (year > 2015) {
    const tail2 = Number(String(year).slice(-2));
    const tail3 = Number(String(year).slice(-3));
    if (tail2 <= 15) year = 2000 + tail2;
    else if (tail3 >= 100 && tail3 <= 115) year = 1900 + tail3;
    else if (tail3 >= 50 && tail3 <= 99) year = 2000 + tail3;
    else if (year >= 10000) year = Number(String(year).slice(-4));
    else year -= 200;
  }
  if (year < 1950 || year > 2015) return text;
  return `${year}-${month}-${day}`;
}

const rows = await prisma.importBatchRow.findMany({
  where: { batchId, status: 'VALID' },
  select: { id: true, rowNumber: true, normalized: true },
  orderBy: { rowNumber: 'asc' },
});

let fixed = 0;
for (const row of rows) {
  const normalized = row.normalized ?? {};
  const current = normalized.dateOfBirth;
  if (!current) continue;
  const next = fixDob(current);
  if (next !== current) {
    await prisma.importBatchRow.update({
      where: { id: row.id },
      data: {
        normalized: { ...normalized, dateOfBirth: next },
        errors: [],
      },
    });
    fixed += 1;
    console.log(
      `Row ${row.rowNumber} (${normalized.enrollmentNumber ?? ''}): ${current} -> ${next}`,
    );
  }
}

await prisma.importBatch.update({
  where: { id: batchId },
  data: {
    status: 'VALIDATED',
    errorMessage: null,
    completedAt: null,
  },
});

console.log(`Fixed ${fixed} DOB value(s). Batch reset to VALIDATED.`);

await prisma.$disconnect();
