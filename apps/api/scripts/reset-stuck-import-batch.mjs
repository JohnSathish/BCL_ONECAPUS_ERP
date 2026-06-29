import { PrismaClient } from '@prisma/client';

const batchId = process.argv[2] ?? 'f571e56c-248e-4f19-8690-d570d373cabb';
const prisma = new PrismaClient();

const batch = await prisma.importBatch.update({
  where: { id: batchId },
  data: {
    status: 'VALIDATED',
    successfulRows: 0,
    failedRows: 0,
    errorMessage: null,
    completedAt: null,
  },
});

console.log('Reset batch:', {
  id: batch.id,
  status: batch.status,
  fileName: batch.fileName,
  validRows: batch.validRows,
});
await prisma.$disconnect();
