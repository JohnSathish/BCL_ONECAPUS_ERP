import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });
  const prisma = app.get(PrismaService);
  const tenant = await prisma.tenant.findFirst({
    where: { name: { contains: 'Don Bosco' } },
  });
  const needles = [
    'SENGPRANG',
    'LOUIS',
    'TIRKEY',
    'CHARE',
    'SENBACHI',
    'VICKY',
    'CHONME',
    'CHELSEA',
    'BRILLIANT',
    'ZAKKUL',
    'SANGRA',
    'JORDANA',
    'MADHUSUDHAN',
  ];
  for (const n of needles) {
    const rows = await prisma.staffProfile.findMany({
      where: {
        tenantId: tenant!.id,
        deletedAt: null,
        fullName: { contains: n, mode: 'insensitive' },
      },
      select: { employeeCode: true, fullName: true, staffType: true },
    });
    console.log(
      n,
      '->',
      rows.length
        ? rows.map((r) => `${r.employeeCode} | ${r.fullName}`).join('; ')
        : 'NONE',
    );
  }
  const all = await prisma.staffProfile.count({
    where: { tenantId: tenant!.id, deletedAt: null },
  });
  console.log('Total staff:', all);
  await app.close();
}

main();
