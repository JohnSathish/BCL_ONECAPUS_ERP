import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const batchId = process.argv[2];
const rowNumber = Number(process.argv[3] ?? 3);

if (!batchId) {
  console.error(
    'Usage: node scripts/inspect-import-row-normalized.mjs <batchId> [rowNumber]',
  );
  process.exit(1);
}

const row = await prisma.importBatchRow.findFirst({
  where: { batchId, rowNumber },
  select: {
    rowNumber: true,
    status: true,
    errors: true,
    normalized: true,
    raw: true,
  },
});

console.log(JSON.stringify(row, null, 2));
await prisma.$disconnect();
