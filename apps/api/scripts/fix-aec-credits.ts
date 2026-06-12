import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SEM1_CODES = [
  'ECO-100',
  'GEO-100',
  'MDC-111',
  'SEC-132',
  'VAC-140',
] as const;

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  if (!tenant) {
    console.error('Demo tenant not found');
    process.exit(1);
  }

  const aecCandidates = await prisma.course.findMany({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      OR: [
        { code: 'AEC-123' },
        { code: 'AEC–123' },
        { code: { contains: 'AEC' } },
      ],
    },
    select: { id: true, code: true, title: true, credits: true },
    orderBy: { code: 'asc' },
  });

  console.log('\n=== AEC courses (before) ===');
  for (const row of aecCandidates) {
    console.log(`  ${row.code} — ${row.title}: ${row.credits} credits`);
  }

  const toFix = aecCandidates.filter(
    (c) =>
      (c.code === 'AEC-123' || c.code === 'AEC–123') && Number(c.credits) === 4,
  );

  if (!toFix.length) {
    console.log(
      '\nNo AEC-123 course with 4 credits found (may already be fixed).',
    );
  } else {
    for (const course of toFix) {
      await prisma.course.update({
        where: { id: course.id },
        data: { credits: 3 },
      });
      console.log(`\nUpdated ${course.code} (${course.title}): 4 → 3 credits`);
    }
  }

  console.log('\n=== Sem 1 basket credits (after fix) ===');
  const allCodes = [...SEM1_CODES, 'AEC-123', 'AEC–123'];
  const basket = await prisma.course.findMany({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      code: { in: allCodes },
    },
    select: { code: true, title: true, credits: true },
    orderBy: { code: 'asc' },
  });

  let total = 0;
  for (const row of basket) {
    const credits = Number(row.credits);
    total += credits;
    console.log(`  ${row.code}: ${credits}`);
  }
  console.log(`  Total (if all selected): ${total} credits (target: 20)`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
