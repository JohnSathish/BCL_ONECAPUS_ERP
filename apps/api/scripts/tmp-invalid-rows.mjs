import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const batchId = process.argv[2];
if (!batchId) {
  console.error('Usage: node scripts/tmp-invalid-rows.mjs <batchId>');
  process.exit(1);
}

const rows = await prisma.importBatchRow.findMany({
  where: { batchId, status: 'INVALID' },
  select: { rowNumber: true, errors: true, raw: true },
  orderBy: { rowNumber: 'asc' },
});
console.log(`Invalid rows: ${rows.length}`);
for (const row of rows) {
  const raw = row.raw ?? {};
  const name = String(raw.fullName ?? raw['Full Name'] ?? '');
  const errors = Array.isArray(row.errors)
    ? row.errors.join('; ')
    : String(row.errors ?? '');
  console.log(`Row ${row.rowNumber} - ${name}: ${errors}`);
}
await prisma.$disconnect();
