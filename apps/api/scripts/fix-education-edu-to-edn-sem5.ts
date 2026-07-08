/**
 * Remap Education Sem5 MAJOR lines from soft-deleted EDU-30x -> active EDN-30x.
 *
 *   npx ts-node --transpile-only scripts/fix-education-edu-to-edn-sem5.ts
 *   npx ts-node --transpile-only scripts/fix-education-edu-to-edn-sem5.ts --dry-run
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const TARGET_ROLLS = [
  'BA24-911',
  'BA24-928',
  'BA24-971',
  'BA24-973',
  'BA24-975',
] as const;

const CODE_MAP: Record<string, string> = {
  'EDU-300': 'EDN-300',
  'EDU-301': 'EDN-301',
  'EDU-302': 'EDN-302',
};

const DRY_RUN = process.argv.includes('--dry-run');
const prisma = new PrismaClient();

async function resolveTenant() {
  const tenantSlug = process.env.TENANT_SLUG?.trim();
  if (tenantSlug) {
    const tenant = await prisma.tenant.findFirst({
      where: { slug: tenantSlug },
      select: { id: true, name: true, slug: true },
    });
    if (!tenant) throw new Error(`Tenant slug "${tenantSlug}" not found`);
    return tenant;
  }
  return (
    (await prisma.tenant.findFirst({
      where: { slug: 'demo' },
      select: { id: true, name: true, slug: true },
    })) ??
    (await prisma.tenant.findFirst({
      where: { name: { contains: 'Don Bosco' } },
      select: { id: true, name: true, slug: true },
    }))
  );
}

async function main() {
  const tenant = await resolveTenant();
  if (!tenant) throw new Error('Tenant not found');
  console.log(`Tenant: ${tenant.name} (${tenant.slug ?? tenant.id})`);
  console.log(DRY_RUN ? 'Mode: DRY RUN\n' : 'Mode: APPLY\n');

  const ednCourses = await prisma.course.findMany({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      code: { in: Object.values(CODE_MAP) },
    },
    select: { id: true, code: true, title: true },
  });
  const ednByCode = new Map(ednCourses.map((c) => [c.code, c]));
  for (const target of Object.values(CODE_MAP)) {
    if (!ednByCode.has(target)) {
      throw new Error(`Active target course missing: ${target}`);
    }
  }

  const offerings = await prisma.courseOffering.findMany({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      semesterSequence: 5,
      category: 'MAJOR',
      courseId: { in: ednCourses.map((c) => c.id) },
    },
    select: {
      id: true,
      courseId: true,
      programVersionId: true,
      course: { select: { code: true, title: true } },
    },
    orderBy: [{ createdAt: 'asc' }],
  });

  if (!offerings.length) {
    throw new Error('No active Sem5 MAJOR offerings found for EDN-300/301/302');
  }

  console.log('Active EDN Sem5 MAJOR offerings:');
  for (const offering of offerings) {
    console.log(
      `  ${offering.course.code} -> offering ${offering.id} (pv=${offering.programVersionId ?? 'null'})`,
    );
  }

  const students = await prisma.student.findMany({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      rollNumber: { in: [...TARGET_ROLLS] },
    },
    select: {
      id: true,
      rollNumber: true,
      programVersionId: true,
      semesterRegistrations: {
        where: { semesterSequence: 5 },
        take: 1,
        orderBy: { createdAt: 'desc' },
        include: {
          lines: {
            where: { category: 'MAJOR' },
            include: {
              offering: {
                include: {
                  course: {
                    select: {
                      id: true,
                      code: true,
                      title: true,
                      deletedAt: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  let updated = 0;
  let skipped = 0;
  let missing = 0;

  for (const roll of TARGET_ROLLS) {
    const student = students.find(
      (s) => String(s.rollNumber).toUpperCase() === roll.toUpperCase(),
    );
    if (!student) {
      missing += 1;
      console.log(`[MISSING] ${roll}`);
      continue;
    }

    const reg = student.semesterRegistrations[0];
    if (!reg) {
      missing += 1;
      console.log(`[NO_REG] ${roll}`);
      continue;
    }

    console.log(`\n${roll} (student=${student.id})`);
    for (const line of reg.lines) {
      const code = line.offering?.course?.code ?? '';
      const targetCode = CODE_MAP[code];
      if (!targetCode) {
        skipped += 1;
        console.log(`  skip line ${line.id}: ${code || '?'}`);
        continue;
      }

      const preferred =
        offerings.find(
          (o) =>
            o.course.code === targetCode &&
            student.programVersionId &&
            o.programVersionId === student.programVersionId,
        ) ?? offerings.find((o) => o.course.code === targetCode);

      if (!preferred) {
        throw new Error(`No Sem5 MAJOR offering for ${targetCode}`);
      }

      if (line.offeringId === preferred.id) {
        skipped += 1;
        console.log(`  already mapped: ${code} -> ${targetCode}`);
        continue;
      }

      console.log(
        `  ${DRY_RUN ? 'would remap' : 'remap'} ${code} -> ${targetCode} (${line.offeringId} -> ${preferred.id})`,
      );

      if (!DRY_RUN) {
        await prisma.semesterRegistrationLine.update({
          where: { id: line.id },
          data: {
            offeringId: preferred.id,
            assignmentSource: 'ADMIN_OVERRIDE',
            registrationSource: 'ADMIN_ASSIGNED',
            eligibilityOverride: true,
            eligibilityOverrideReason:
              'Remapped soft-deleted EDU-* Education major paper to active EDN-* course',
          },
        });
      }
      updated += 1;
    }
  }

  console.log('\nDone.');
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Missing: ${missing}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
