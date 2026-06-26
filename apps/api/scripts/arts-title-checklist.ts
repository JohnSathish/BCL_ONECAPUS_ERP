import { PrismaClient } from '@prisma/client';
import { buildArtsFyugpOddCourses } from '../src/modules/academic-engine/domain/arts-fyugp-odd-catalog';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  if (!tenant) throw new Error('Demo tenant not found');

  const seedCourses = buildArtsFyugpOddCourses().filter(
    (c) => !c.sharedPool && c.programCode,
  );
  const seedByCode = new Map(seedCourses.map((c) => [c.code, c]));

  const courses = await prisma.course.findMany({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      code: { in: [...seedByCode.keys()] },
    },
    select: {
      code: true,
      title: true,
      updatedAt: true,
      department: { select: { code: true, name: true } },
    },
    orderBy: [{ department: { code: 'asc' } }, { code: 'asc' }],
  });

  const seedBatch = '2026-06-21T20:43:33';
  const likelyOverwritten: typeof courses = [];
  const alreadyCustom: typeof courses = [];
  const missing: string[] = [];

  for (const def of seedCourses) {
    if (!courses.find((c) => c.code === def.code)) {
      missing.push(def.code);
    }
  }

  for (const c of courses) {
    const seed = seedByCode.get(c.code)!;
    const matchesSeed = c.title.trim() === seed.title.trim();
    const batchUpdated = c.updatedAt
      .toISOString()
      .startsWith('2026-06-21T20:43');
    if (matchesSeed && batchUpdated) {
      likelyOverwritten.push(c);
    } else if (!matchesSeed) {
      alreadyCustom.push(c);
    }
  }

  console.log('='.repeat(72));
  console.log(
    'ARTS COURSE TITLE CHECKLIST — likely need your corrections re-entered',
  );
  console.log('='.repeat(72));
  console.log(
    `These ${likelyOverwritten.length} courses match the demo seed template and were`,
  );
  console.log(
    'batch-updated on 21 Jun 2026 — your earlier edits were probably reset.\n',
  );

  let lastDept = '';
  for (const c of likelyOverwritten.sort((a, b) =>
    a.code.localeCompare(b.code),
  )) {
    const seed = seedByCode.get(c.code)!;
    const dept = c.department?.code ?? seed.departmentCode;
    if (dept !== lastDept) {
      console.log(
        `\n## ${dept} (${c.department?.name ?? dept}) — ${seed.programCode}`,
      );
      lastDept = dept;
    }
    console.log(
      `  [ ] ${c.code}  →  currently: "${c.title}"  (Sem ${seed.semesterSequence} ${seed.category})`,
    );
  }

  console.log('\n' + '='.repeat(72));
  console.log(
    `ALREADY CUSTOM — ${alreadyCustom.length} courses (titles differ from seed; likely OK)`,
  );
  console.log('='.repeat(72));
  for (const c of alreadyCustom.sort((a, b) => a.code.localeCompare(b.code))) {
    const seed = seedByCode.get(c.code)!;
    console.log(`  ✓ ${c.code}  DB: "${c.title}"  (seed had: "${seed.title}")`);
  }

  const okOther = courses.filter(
    (c) => !likelyOverwritten.includes(c) && !alreadyCustom.includes(c),
  );
  if (okOther.length) {
    console.log('\n' + '='.repeat(72));
    console.log(
      `OTHER — ${okOther.length} courses match seed but updated on different dates`,
    );
    console.log('='.repeat(72));
    for (const c of okOther) {
      console.log(
        `  · ${c.code}  "${c.title}"  updated ${c.updatedAt.toISOString().slice(0, 10)}`,
      );
    }
  }

  if (missing.length) {
    console.log('\nMissing from DB:', missing.join(', '));
  }

  console.log('\n--- How to fix ---');
  console.log('1. Programs → Course catalog');
  console.log(
    '2. Filter: department + semester + category (e.g. ENG, Sem 1, MAJOR)',
  );
  console.log('3. Edit each [ ] course → enter correct title → Save');
  console.log('4. After save, titles are locked against future seed runs.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
