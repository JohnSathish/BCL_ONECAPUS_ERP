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
    logger: ['error'],
  });
  const prisma = app.get(PrismaService);
  const importSvc = app.get(PayAssignmentImportService);
  const tenant = await prisma.tenant.findFirst({
    where: { name: { contains: 'Don Bosco' } },
  });
  if (!tenant) throw new Error('tenant missing');
  const user = {
    sub: 'system',
    tid: tenant.id,
    email: 'system',
    permissions: [],
    roles: [],
  };
  const result = await importSvc.validate(user as never, buf);
  console.log(
    JSON.stringify(
      {
        total: result.total,
        valid: result.valid,
        invalid: result.invalid,
        invalidRows: result.rows
          .filter((r) => r.errors.length)
          .slice(0, 15)
          .map((r) => ({
            row: r.rowNumber,
            code: r.employeeCode,
            errors: r.errors,
          })),
      },
      null,
      2,
    ),
  );
  await app.close();
}

main();
