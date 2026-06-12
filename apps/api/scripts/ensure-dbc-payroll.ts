import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DbcPayrollSetupService } from '../src/modules/payroll/services/dbc-payroll-setup.service';
import { PrismaService } from '../src/database/prisma.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const setup = app.get(DbcPayrollSetupService);
  const prisma = app.get(PrismaService);
  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  for (const tenant of tenants) {
    await setup.ensureTenant(tenant.id);
  }
  await app.close();
  console.log(
    'DBC payroll structures ensured for',
    tenants.length,
    'tenant(s)',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
