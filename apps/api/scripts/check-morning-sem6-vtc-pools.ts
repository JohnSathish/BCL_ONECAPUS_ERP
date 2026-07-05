import { PrismaClient } from '@prisma/client';
import { MORNING_SEM6_VTC_CODES } from '../src/modules/academic-engine/domain/dbc-morning-sem6-vtc-electives-catalog';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  if (!tenant) throw new Error('demo tenant not found');

  const pool = await prisma.categoryPool.findFirst({
    where: {
      tenantId: tenant.id,
      poolName: 'Morning Shift Sem 6 VTC',
      active: true,
    },
    include: {
      courses: {
        where: { active: true },
        include: { course: { select: { code: true } } },
        orderBy: { displayOrder: 'asc' },
      },
    },
  });

  console.log('\n=== Morning Shift Sem 6 VTC ===');
  if (!pool) {
    console.log('MISSING pool');
    return;
  }

  const mapped = pool.courses.map((row) => row.course.code);
  const missing = MORNING_SEM6_VTC_CODES.filter(
    (code) => !mapped.includes(code),
  );
  const extra = mapped.filter(
    (code) => !(MORNING_SEM6_VTC_CODES as readonly string[]).includes(code),
  );

  if (missing.length) console.log(`MISSING ${missing.join(', ')}`);
  if (extra.length)
    console.log(`EXTRA (should be inactive): ${extra.join(', ')}`);
  if (!missing.length && !extra.length) {
    console.log(`OK (${mapped.join(', ')})`);
  }

  console.log(`\n=== Summary: ${missing.length + extra.length} gap(s) ===`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
