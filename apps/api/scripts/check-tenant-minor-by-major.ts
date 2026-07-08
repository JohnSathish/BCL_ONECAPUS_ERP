import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { Sem5ImportCurriculumService } from '../src/modules/students/import/sem5-import-curriculum.service';
import { MajorMinorEligibilityService } from '../src/modules/academic-engine/services/major-minor-eligibility.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });
  const prisma = app.get(PrismaService);
  const sem5 = app.get(Sem5ImportCurriculumService);
  const eligibility = app.get(MajorMinorEligibilityService);

  const tenant =
    (await prisma.tenant.findFirst({ where: { slug: 'demo' } })) ??
    (await prisma.tenant.findFirst({
      where: { name: { contains: 'Don Bosco' } },
    }));
  if (!tenant) throw new Error('Tenant not found');

  const morning = await prisma.shift.findFirst({
    where: {
      tenantId: tenant.id,
      code: { equals: 'MORNING', mode: 'insensitive' },
      status: 'ACTIVE',
    },
  });
  const baRef = await prisma.programVersion.findFirst({
    where: {
      tenantId: tenant.id,
      status: 'PUBLISHED',
      program: { code: { startsWith: 'BA-' } },
    },
    include: { program: true },
    orderBy: [{ program: { code: 'asc' } }, { effectiveFrom: 'desc' }],
  });
  const bcom = await prisma.programVersion.findFirst({
    where: {
      tenantId: tenant.id,
      status: 'PUBLISHED',
      program: { code: { startsWith: 'BCOM' } },
    },
    include: { program: true },
  });

  console.log('BA reference for tenant-wide minors:', baRef?.program.code);
  console.log('BCOM version:', bcom?.program.code);

  for (const [label, versionId] of [
    ['BA reference + commerce major', baRef?.id],
    ['BCOM + commerce major', bcom?.id],
  ] as const) {
    if (!versionId) continue;
    const eligible = await eligibility.listEligibleMinors(
      tenant.id,
      versionId,
      'commerce',
      5,
      undefined,
      morning?.id,
    );
    console.log(`\n${label}:`);
    for (const minor of eligible) {
      console.log(`  - ${minor.department?.name ?? minor.name}`);
    }
  }

  const tenantMap = await sem5.buildTenantMinorByMajor(tenant.id, morning?.id);
  console.log(
    '\nbuildTenantMinorByMajor Commerce:',
    tenantMap[sem5.normalizeLabel('Commerce')],
  );

  await app.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
