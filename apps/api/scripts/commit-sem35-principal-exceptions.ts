/**
 * Record named Principal major–minor overrides after Sem 5 CREATE import.
 * Does not change the college-wide combination table.
 *
 *   npx ts-node --transpile-only scripts/commit-sem35-principal-exceptions.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { StudentMajorMinorOverrideService } from '../src/modules/academic-engine/services/student-major-minor-override.service';

const OVERRIDES: Array<{
  roll: string;
  major: string;
  minor: string;
  fromSemester: number;
}> = [
  {
    roll: 'BA24-630',
    major: 'History',
    minor: 'Education',
    fromSemester: 5,
  },
  {
    roll: 'BA24-911',
    major: 'Education',
    minor: 'Political Science',
    fromSemester: 5,
  },
  {
    roll: 'BA24-918',
    major: 'Political Science',
    minor: 'Garo',
    fromSemester: 5,
  },
  {
    roll: 'BA24-928',
    major: 'Education',
    minor: 'Sociology',
    fromSemester: 5,
  },
  {
    roll: 'BS24-039',
    major: 'Chemistry',
    minor: 'Botany',
    fromSemester: 5,
  },
  {
    roll: 'BS24-113',
    major: 'Chemistry',
    minor: 'Botany',
    fromSemester: 5,
  },
];

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

async function resolveSubjectId(
  prisma: PrismaService,
  tenantId: string,
  label: string,
) {
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
  const match =
    rows.find((row) => normalizeLabel(row.name) === desired) ??
    rows.find(
      (row) => normalizeLabel(row.department?.name ?? '') === desired,
    ) ??
    rows.find((row) => row.slug === desiredSlug);
  if (!match) throw new Error(`Academic subject not found for "${label}"`);
  return match.id;
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const prisma = app.get(PrismaService);
    const overrides = app.get(StudentMajorMinorOverrideService);
    const tenant =
      (await prisma.tenant.findFirst({ where: { slug: 'demo' } })) ??
      (await prisma.tenant.findFirst({
        where: { name: { contains: 'Don Bosco' } },
      }));
    if (!tenant) throw new Error('Tenant not found');
    const admin = await prisma.user.findFirst({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!admin) throw new Error('Admin user not found');

    for (const entry of OVERRIDES) {
      const student = await prisma.student.findFirst({
        where: {
          tenantId: tenant.id,
          deletedAt: null,
          OR: [
            { enrollmentNumber: { equals: entry.roll, mode: 'insensitive' } },
            { rollNumber: { equals: entry.roll, mode: 'insensitive' } },
          ],
        },
        select: { id: true, enrollmentNumber: true },
      });
      if (!student) {
        throw new Error(`Imported student ${entry.roll} not found`);
      }
      const existing = await prisma.studentMajorMinorOverride.findFirst({
        where: {
          tenantId: tenant.id,
          studentId: student.id,
          status: 'APPROVED',
          revokedAt: null,
        },
      });
      if (existing) {
        console.log(`Override already exists for ${entry.roll}`);
        continue;
      }
      await overrides.createOverride(tenant.id, student.id, admin.id, {
        majorSubjectId: await resolveSubjectId(prisma, tenant.id, entry.major),
        minorSubjectId: await resolveSubjectId(prisma, tenant.id, entry.minor),
        effectiveFromSemester: entry.fromSemester,
        status: 'APPROVED',
        approvalAuthority: 'PRINCIPAL',
        approvalRef: 'Principal-Sem5-2024-exceptions',
        reason:
          'Principal-approved unofficial major-minor pair for a named Semester 5 student. Not a change to the official combination table.',
        metadata: {
          roll: entry.roll,
          major: entry.major,
          minor: entry.minor,
        },
      });
      console.log(
        `Override recorded: ${entry.roll} ${entry.major} + ${entry.minor}`,
      );
    }
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
