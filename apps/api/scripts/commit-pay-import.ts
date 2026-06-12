import { readFile } from 'fs/promises';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PayAssignmentImportService } from '../src/modules/payroll/services/pay-assignment-import.service';
import { PrismaService } from '../src/database/prisma.service';

async function main() {
  const buf = await readFile(
    'E:/Projects/1505NEWERP/staff-pay-assignments-import.xlsx',
  );
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const prisma = app.get(PrismaService);
  const importSvc = app.get(PayAssignmentImportService);
  const tenant = await prisma.tenant.findFirst({
    where: { name: { contains: 'Don Bosco' } },
  });
  if (!tenant) throw new Error('Don Bosco tenant not found');

  const admin = await prisma.user.findFirst({
    where: { tenantId: tenant.id, deletedAt: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });

  const user = {
    sub: admin?.id ?? '00000000-0000-0000-0000-000000000000',
    tid: tenant.id,
    email: 'system',
    permissions: [],
    roles: [],
  };

  const validation = await importSvc.validate(user as never, buf);
  console.log(
    'Validation:',
    validation.valid,
    'valid /',
    validation.invalid,
    'invalid of',
    validation.total,
  );

  if (validation.invalid > 0) {
    console.log(
      'Invalid rows:',
      validation.rows.filter((r) => r.errors.length).slice(0, 5),
    );
    await app.close();
    process.exit(1);
  }

  const result = await importSvc.commit(user as never, buf);
  console.log('Import complete:', result);
  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
