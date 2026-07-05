/**
 * Integration smoke test: Philosophy major filter resolves and counts students.
 * Run: npx ts-node -r tsconfig-paths/register scripts/test-report-major-filter.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'demo' },
    select: { id: true },
  });
  if (!tenant) {
    console.error('Demo tenant not found');
    process.exit(1);
  }

  const philosophy = await prisma.academicSubject.findFirst({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      OR: [
        { name: { equals: 'Philosophy', mode: 'insensitive' } },
        { slug: 'philosophy' },
      ],
    },
    select: { id: true, name: true },
  });

  if (!philosophy) {
    console.error('Philosophy academic subject not found');
    process.exit(1);
  }

  const total = await prisma.student.count({
    where: { tenantId: tenant.id, deletedAt: null },
  });

  const philosophyCount = await prisma.student.count({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      majorMinorTrack: { majorSubjectId: philosophy.id },
    },
  });

  console.log(`Total students: ${total}`);
  console.log(`Philosophy major students: ${philosophyCount}`);
  console.log(`Subject: ${philosophy.name} (${philosophy.id})`);

  if (philosophyCount >= total) {
    console.error(
      'FAIL: Philosophy filter should return fewer than all students',
    );
    process.exit(1);
  }
  if (philosophyCount === 0) {
    console.warn(
      'WARN: No Philosophy majors in demo data — filter wiring OK but no rows',
    );
  } else {
    console.log('OK: Major filter narrows result set');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
