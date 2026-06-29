import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const tenant = await prisma.tenant.findFirst({
  where: { slug: process.env.TENANT_SLUG ?? 'demo' },
  select: { id: true, slug: true },
});
if (!tenant) {
  console.error('Tenant not found');
  process.exit(1);
}

const batches = await prisma.importBatch.findMany({
  where: { tenantId: tenant.id, module: 'STUDENT_MASTER' },
  orderBy: { createdAt: 'desc' },
  take: 10,
  select: {
    id: true,
    fileName: true,
    status: true,
    totalRows: true,
    validRows: true,
    successfulRows: true,
    failedRows: true,
    errorMessage: true,
    createdAt: true,
    completedAt: true,
  },
});

console.log('Tenant:', tenant.slug);
console.log('\nRecent student import batches:');
for (const b of batches) {
  console.log(
    JSON.stringify({
      id: b.id,
      file: b.fileName,
      status: b.status,
      total: b.totalRows,
      valid: b.validRows,
      imported: b.successfulRows,
      failed: b.failedRows,
      error: b.errorMessage?.slice(0, 120) ?? null,
      createdAt: b.createdAt.toISOString(),
      completedAt: b.completedAt?.toISOString() ?? null,
    }),
  );
}

const bcomBatch = await prisma.admissionBatch.findFirst({
  where: {
    tenantId: tenant.id,
    batchCode: { contains: '2025', mode: 'insensitive' },
  },
  select: { id: true, batchCode: true, currentSemester: true },
});

const comProgram = await prisma.program.findFirst({
  where: { tenantId: tenant.id, code: 'COM' },
  select: { id: true, code: true },
});

let bcomStudents = null;
if (bcomBatch && comProgram) {
  const pvs = await prisma.programVersion.findMany({
    where: { programId: comProgram.id, deletedAt: null },
    select: { id: true },
  });
  const pvIds = pvs.map((p) => p.id);
  bcomStudents = await prisma.student.count({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      programVersionId: { in: pvIds },
      admissionDate: { not: null },
    },
  });
}

const importSourceStudents = await prisma.student.count({
  where: {
    tenantId: tenant.id,
    deletedAt: null,
    importSource: 'IMPORT',
    importBatchId: { not: null },
  },
});

const recentImportBatchId = batches.find(
  (b) => b.fileName?.includes('BCOM') && b.successfulRows > 0,
)?.id;

let fromLatestBcomBatch = 0;
if (recentImportBatchId) {
  fromLatestBcomBatch = await prisma.student.count({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      importBatchId: recentImportBatchId,
    },
  });
}

const rollPrefix = await prisma.student.findMany({
  where: {
    tenantId: tenant.id,
    deletedAt: null,
    rollNumber: { startsWith: 'BC25', mode: 'insensitive' },
  },
  select: {
    rollNumber: true,
    enrollmentNumber: true,
    importBatchId: true,
    createdAt: true,
    masterProfile: { select: { fullName: true } },
  },
  orderBy: { rollNumber: 'asc' },
});

console.log('\nSummary:');
console.log({
  totalStudentsWithImportSource: importSourceStudents,
  bcomProgramStudentsApprox: bcomStudents,
  fromLatestSuccessfulBcomBatch: fromLatestBcomBatch,
  bc25RollStudents: rollPrefix.length,
});

if (rollPrefix.length) {
  console.log('\nBC25 roll students (first 15):');
  for (const s of rollPrefix.slice(0, 15)) {
    console.log(
      s.rollNumber,
      s.enrollmentNumber,
      s.masterProfile?.fullName,
      s.createdAt.toISOString().slice(0, 10),
    );
  }
  if (rollPrefix.length > 15) {
    console.log(`... and ${rollPrefix.length - 15} more`);
  }
}

const importedRows = await prisma.importBatchRow.count({
  where: {
    batchId: batches[0]?.id,
    status: 'IMPORTED',
  },
});

console.log('\nLatest batch imported row count:', importedRows);

await prisma.$disconnect();
