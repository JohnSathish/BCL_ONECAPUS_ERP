import { PrismaClient } from '@prisma/client';
import {
  MORNING_SEM3_AEC_CODES,
  MORNING_SEM3_MDC_CODES,
  MORNING_SEM3_SEC_CODES,
  MORNING_SEM3_VTC_CODES,
} from '../src/modules/academic-engine/domain/dbc-morning-sem3-catalog';

const prisma = new PrismaClient();

const MORNING_POOLS = [
  { name: 'Morning Shift Sem 3 MDC', codes: MORNING_SEM3_MDC_CODES },
  { name: 'Morning Shift Sem 3 AEC', codes: MORNING_SEM3_AEC_CODES },
  { name: 'Morning Shift Sem 3 SEC', codes: MORNING_SEM3_SEC_CODES },
  { name: 'Morning Shift Sem 3 VTC', codes: MORNING_SEM3_VTC_CODES },
] as const;

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  if (!tenant) throw new Error('demo tenant not found');

  let gaps = 0;

  for (const poolDef of MORNING_POOLS) {
    const pool = await prisma.categoryPool.findFirst({
      where: { tenantId: tenant.id, poolName: poolDef.name, active: true },
      include: {
        courses: {
          where: { active: true },
          include: { course: { select: { code: true } } },
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    console.log(`\n=== ${poolDef.name} ===`);
    if (!pool) {
      console.log('MISSING pool');
      gaps += poolDef.codes.length;
      continue;
    }

    const mapped = pool.courses.map((row) => row.course.code);
    const missing = poolDef.codes.filter((code) => !mapped.includes(code));
    const extra = mapped.filter(
      (code) => !(poolDef.codes as readonly string[]).includes(code),
    );

    if (missing.length) {
      gaps += missing.length;
      console.log(`MISSING ${missing.join(', ')}`);
    }
    if (extra.length) {
      gaps += extra.length;
      console.log(`EXTRA (should be inactive): ${extra.join(', ')}`);
    }
    if (!missing.length && !extra.length) {
      console.log(`OK (${mapped.join(', ')})`);
    }
  }

  console.log(`\n=== Summary: ${gaps} gap(s) ===`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
