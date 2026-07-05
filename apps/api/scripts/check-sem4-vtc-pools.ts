import { PrismaClient } from '@prisma/client';
import {
  DAY_SEM4_VTC_CODES,
  MORNING_SEM4_VTC_CODES,
} from '../src/modules/academic-engine/domain/dbc-sem4-vtc-electives-catalog';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  if (!tenant) throw new Error('demo tenant not found');

  let gaps = 0;

  for (const poolDef of [
    { name: 'Day Shift Sem 4 VTC', codes: DAY_SEM4_VTC_CODES },
    { name: 'Morning Shift Sem 4 VTC', codes: MORNING_SEM4_VTC_CODES },
  ]) {
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
