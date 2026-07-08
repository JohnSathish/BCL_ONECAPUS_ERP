import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const batchId = process.argv[2];

async function main() {
  const where = batchId ? { id: batchId } : { module: 'STUDENT_MASTER' };

  const batches = await prisma.importBatch.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: batchId ? 1 : 8,
    include: {
      rows: {
        select: { status: true },
      },
    },
  });

  for (const batch of batches) {
    const rowCounts = batch.rows.reduce((acc, row) => {
      acc[row.status] = (acc[row.status] ?? 0) + 1;
      return acc;
    }, {});

    console.log('---');
    console.log('id:', batch.id);
    console.log('file:', batch.fileName);
    console.log('status:', batch.status);
    console.log('total:', batch.totalRows);
    console.log('valid:', batch.validRows);
    console.log('invalid:', batch.invalidRows);
    console.log('successful:', batch.successfulRows);
    console.log('failed:', batch.failedRows);
    console.log('error:', batch.errorMessage ?? '(none)');
    console.log('created:', batch.createdAt);
    console.log('completed:', batch.completedAt ?? '(not completed)');
    console.log('row status counts:', rowCounts);
  }

  if (batchId) {
    const failedRows = await prisma.importBatchRow.findMany({
      where: { batchId, status: { in: ['INVALID', 'FAILED'] } },
      select: { rowNumber: true, status: true, errors: true },
      orderBy: { rowNumber: 'asc' },
      take: 20,
    });
    if (failedRows.length) {
      console.log('\nSample failed/invalid rows:');
      for (const row of failedRows) {
        const errors = Array.isArray(row.errors)
          ? row.errors.join('; ')
          : String(row.errors ?? '');
        console.log(`  Row ${row.rowNumber} [${row.status}]: ${errors}`);
      }
    }

    const importedCount = await prisma.student.count({
      where: { importBatchId: batchId, deletedAt: null },
    });
    console.log('\nStudents created for this batch:', importedCount);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
