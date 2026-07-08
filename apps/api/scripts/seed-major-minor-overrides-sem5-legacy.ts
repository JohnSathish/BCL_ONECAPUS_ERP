import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

type LegacyOverrideSeed = {
  rollNumber: string;
  majorDepartment: string;
  minorDepartment: string;
};

const LEGACY_STUDENTS: LegacyOverrideSeed[] = [
  {
    rollNumber: 'BA24-630',
    majorDepartment: 'History',
    minorDepartment: 'Education',
  },
  {
    rollNumber: 'BA24-911',
    majorDepartment: 'Education',
    minorDepartment: 'Political Science',
  },
  {
    rollNumber: 'BA24-918',
    majorDepartment: 'Political Science',
    minorDepartment: 'Garo',
  },
  {
    rollNumber: 'BA24-928',
    majorDepartment: 'Education',
    minorDepartment: 'Sociology',
  },
  {
    rollNumber: 'BA24-956',
    majorDepartment: 'Garo',
    minorDepartment: 'Political Science',
  },
  {
    rollNumber: 'BA24-971',
    majorDepartment: 'Education',
    minorDepartment: 'Sociology',
  },
  {
    rollNumber: 'BA24-973',
    majorDepartment: 'Education',
    minorDepartment: 'Sociology',
  },
  {
    rollNumber: 'BA24-975',
    majorDepartment: 'Education',
    minorDepartment: 'Sociology',
  },
  {
    rollNumber: 'BA24-976',
    majorDepartment: 'Garo',
    minorDepartment: 'Political Science',
  },
  {
    rollNumber: 'BA24-995',
    majorDepartment: 'Garo',
    minorDepartment: 'Political Science',
  },
  {
    rollNumber: 'BA24-1002',
    majorDepartment: 'Garo',
    minorDepartment: 'Political Science',
  },
];

const APPROVAL_REASON =
  process.env.MAJOR_MINOR_OVERRIDE_REASON ??
  'Legacy principal-approved major-minor combination from pre-ERP (Excel era).';
const APPROVAL_REF =
  process.env.MAJOR_MINOR_OVERRIDE_REF ?? 'Legacy-Excel-Approval-Sem5';
const EFFECTIVE_FROM_SEMESTER = Number(
  process.env.MAJOR_MINOR_OVERRIDE_EFFECTIVE_FROM_SEM ?? 5,
);
const DRY_RUN = process.argv.includes('--dry-run');

const prisma = new PrismaClient();

function normalizeLabel(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value: string) {
  return normalizeLabel(value).replace(/\s+/g, '-');
}

async function resolveTenantId() {
  const tenantSlug = process.env.TENANT_SLUG?.trim();
  if (tenantSlug) {
    const tenant = await prisma.tenant.findFirst({
      where: { slug: tenantSlug },
      select: { id: true, name: true, slug: true },
    });
    if (!tenant) {
      throw new Error(`Tenant with slug "${tenantSlug}" not found`);
    }
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

async function resolveSubjectId(tenantId: string, label: string) {
  const desired = normalizeLabel(label);
  const desiredSlug = slugify(label);
  const rows = await prisma.academicSubject.findMany({
    where: { tenantId, deletedAt: null, isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      department: { select: { name: true } },
    },
  });
  const exact = rows.find((row) => normalizeLabel(row.name) === desired);
  if (exact) return exact.id;
  const byDept = rows.find(
    (row) => normalizeLabel(row.department?.name ?? '') === desired,
  );
  if (byDept) return byDept.id;
  const bySlug = rows.find((row) => row.slug === desiredSlug);
  if (bySlug) return bySlug.id;
  throw new Error(`Academic subject not found for "${label}"`);
}

async function main() {
  const tenant = await resolveTenantId();
  console.log(`Using tenant: ${tenant.name} (${tenant.slug ?? tenant.id})`);

  const subjectIdByLabel = new Map<string, string>();
  for (const label of new Set(
    LEGACY_STUDENTS.flatMap((row) => [
      row.majorDepartment,
      row.minorDepartment,
    ]),
  )) {
    const subjectId = await resolveSubjectId(tenant.id, label);
    subjectIdByLabel.set(label, subjectId);
  }

  let created = 0;
  let skipped = 0;
  let missing = 0;

  for (const row of LEGACY_STUDENTS) {
    const student = await prisma.student.findFirst({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        rollNumber: { equals: row.rollNumber, mode: 'insensitive' },
      },
      select: { id: true, rollNumber: true, enrollmentNumber: true },
    });
    if (!student) {
      missing += 1;
      console.warn(`Missing student for roll ${row.rollNumber}`);
      continue;
    }

    const majorSubjectId = subjectIdByLabel.get(row.majorDepartment);
    const minorSubjectId = subjectIdByLabel.get(row.minorDepartment);
    if (!majorSubjectId || !minorSubjectId) {
      throw new Error(
        `Missing subject mapping for ${row.rollNumber} (${row.majorDepartment} / ${row.minorDepartment})`,
      );
    }

    const existing = await prisma.$queryRaw<{ id: string }[]>`
      select id
      from academic.student_major_minor_overrides
      where tenant_id = ${tenant.id}::uuid
        and student_id = ${student.id}::uuid
        and major_subject_id = ${majorSubjectId}::uuid
        and minor_subject_id = ${minorSubjectId}::uuid
        and status = 'APPROVED'
        and revoked_at is null
        and effective_from_semester = ${EFFECTIVE_FROM_SEMESTER}
      limit 1
    `;
    if (existing.length > 0) {
      skipped += 1;
      console.log(`Skipped (already exists): ${row.rollNumber}`);
      continue;
    }

    if (DRY_RUN) {
      created += 1;
      console.log(
        `[dry-run] Create override for ${row.rollNumber}: ${row.majorDepartment} -> ${row.minorDepartment}`,
      );
      continue;
    }

    await prisma.$executeRaw`
      insert into academic.student_major_minor_overrides (
        id,
        tenant_id,
        student_id,
        major_subject_id,
        minor_subject_id,
        effective_from_semester,
        status,
        reason,
        approval_authority,
        approval_ref,
        approved_at,
        created_at,
        updated_at
      )
      values (
        gen_random_uuid(),
        ${tenant.id}::uuid,
        ${student.id}::uuid,
        ${majorSubjectId}::uuid,
        ${minorSubjectId}::uuid,
        ${EFFECTIVE_FROM_SEMESTER},
        'APPROVED',
        ${APPROVAL_REASON},
        'PRINCIPAL',
        ${APPROVAL_REF},
        now(),
        now(),
        now()
      )
    `;
    created += 1;
    console.log(
      `Created override: ${row.rollNumber} (${row.majorDepartment} -> ${row.minorDepartment})`,
    );
  }

  console.log('\nDone.');
  console.log(`Created: ${created}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Missing students: ${missing}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
