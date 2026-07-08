import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const EXPECTED_ROLLS = [
  'BA24-630',
  'BA24-911',
  'BA24-918',
  'BA24-928',
  'BA24-956',
  'BA24-971',
  'BA24-973',
  'BA24-975',
  'BA24-976',
  'BA24-995',
  'BA24-1002',
] as const;

const EFFECTIVE_FROM_SEMESTER = Number(
  process.env.MAJOR_MINOR_OVERRIDE_EFFECTIVE_FROM_SEM ?? 5,
);

const prisma = new PrismaClient();

async function resolveTenantId() {
  const tenantSlug = process.env.TENANT_SLUG?.trim();
  if (tenantSlug) {
    const tenant = await prisma.tenant.findFirst({
      where: { slug: tenantSlug },
      select: { id: true, name: true, slug: true },
    });
    if (!tenant) throw new Error(`Tenant with slug "${tenantSlug}" not found`);
    return tenant;
  }
  const tenant =
    (await prisma.tenant.findFirst({
      where: { slug: 'demo' },
      select: { id: true, name: true, slug: true },
    })) ??
    (await prisma.tenant.findFirst({
      where: { name: { contains: 'Don Bosco' } },
      select: { id: true, name: true, slug: true },
    }));
  if (!tenant) throw new Error('Tenant not found');
  return tenant;
}

async function main() {
  const tenant = await resolveTenantId();
  console.log(`Using tenant: ${tenant.name} (${tenant.slug ?? tenant.id})`);

  const students = await prisma.student.findMany({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      rollNumber: { in: [...EXPECTED_ROLLS] },
    },
    select: { id: true, rollNumber: true, enrollmentNumber: true },
  });
  const studentByRoll = new Map(
    students
      .filter((student) => student.rollNumber)
      .map((student) => [String(student.rollNumber).toUpperCase(), student]),
  );

  const foundRolls: string[] = [];
  const missingRolls: string[] = [];
  for (const roll of EXPECTED_ROLLS) {
    if (studentByRoll.has(roll)) foundRolls.push(roll);
    else missingRolls.push(roll);
  }

  const studentIds = students.map((student) => student.id);
  const overrides = studentIds.length
    ? await prisma.$queryRaw<
        {
          id: string;
          studentId: string;
          effectiveFromSemester: number;
        }[]
      >`
        select
          id,
          student_id as "studentId",
          effective_from_semester as "effectiveFromSemester"
        from academic.student_major_minor_overrides
        where tenant_id = ${tenant.id}::uuid
          and student_id = any(${studentIds}::uuid[])
          and status = 'APPROVED'
          and revoked_at is null
          and effective_from_semester = ${EFFECTIVE_FROM_SEMESTER}
        order by created_at asc
      `
    : [];

  const byStudent = new Map<string, any[]>();
  for (const row of overrides) {
    const bucket = byStudent.get(row.studentId) ?? [];
    bucket.push(row);
    byStudent.set(row.studentId, bucket);
  }

  console.log('\nOverride status by expected roll number:');
  let seededCount = 0;
  for (const roll of EXPECTED_ROLLS) {
    const student = studentByRoll.get(roll);
    if (!student) {
      console.log(`- ${roll}: MISSING_STUDENT`);
      continue;
    }
    const rows = byStudent.get(student.id) ?? [];
    if (!rows.length) {
      console.log(`- ${roll}: STUDENT_FOUND_BUT_NO_OVERRIDE`);
      continue;
    }
    seededCount += 1;
    const latest = rows[rows.length - 1];
    console.log(
      `- ${roll}: SEEDED (overrideId=${latest.id}, semFrom=${latest.effectiveFromSemester})`,
    );
  }

  console.log('\nSummary:');
  console.log(`- Expected rolls: ${EXPECTED_ROLLS.length}`);
  console.log(`- Student records found: ${foundRolls.length}`);
  console.log(`- Seeded (active approved): ${seededCount}`);
  console.log(`- Missing rolls: ${missingRolls.length}`);
  if (missingRolls.length) {
    console.log(`  ${missingRolls.join(', ')}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
