import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  const prisma = app.get(PrismaService);
  const tenant = await prisma.tenant.findFirst({
    where: { name: { contains: 'Don Bosco' } },
  });
  for (const n of [
    'CHANCHIAMAN',
    'AKSANA',
    'CHARE',
    'AMBALIKA',
    'TENANG',
    'ISAAC',
    'FERICK',
  ]) {
    const rows = await prisma.staffProfile.findMany({
      where: {
        tenantId: tenant!.id,
        deletedAt: null,
        fullName: { contains: n, mode: 'insensitive' },
      },
      select: {
        employeeCode: true,
        fullName: true,
        teachingShiftCategory: true,
      },
    });
    console.log(
      n,
      rows
        .map(
          (r) =>
            `${r.employeeCode} | ${r.fullName} | ${r.teachingShiftCategory}`,
        )
        .join('; ') || 'NONE',
    );
  }
  const depts = await prisma.department.findMany({
    where: {
      tenantId: tenant!.id,
      name: { contains: 'viron', mode: 'insensitive' },
    },
    select: { name: true },
  });
  console.log('Env depts:', depts.map((d) => d.name).join(', '));
  await app.close();
}

main();
