import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const total = await prisma.student.count({ where: { deletedAt: null } });
  const withProfile = await prisma.studentProfile.count({
    where: { student: { deletedAt: null } },
  });
  const withDob = await prisma.studentProfile.count({
    where: { dateOfBirth: { not: null }, student: { deletedAt: null } },
  });
  const withoutDob = await prisma.studentProfile.count({
    where: { dateOfBirth: null, student: { deletedAt: null } },
  });

  const ankit = await prisma.student.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { rollNumber: { equals: 'BA24-458', mode: 'insensitive' } },
        { enrollmentNumber: { equals: 'BA24-458', mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      rollNumber: true,
      enrollmentNumber: true,
      importSource: true,
      masterProfile: {
        select: { fullName: true, dateOfBirth: true, email: true },
      },
    },
  });

  const byImportSource = await prisma.$queryRawUnsafe<
    Array<{
      import_source: string | null;
      total: bigint;
      with_dob: bigint;
      missing_dob: bigint;
    }>
  >(`
    SELECT
      COALESCE(s.import_source, '(none)') AS import_source,
      COUNT(*)::bigint AS total,
      COUNT(p.date_of_birth)::bigint AS with_dob,
      COUNT(*) FILTER (WHERE p.date_of_birth IS NULL)::bigint AS missing_dob
    FROM academic.students s
    LEFT JOIN academic.student_profiles p ON p.student_id = s.id
    WHERE s.deleted_at IS NULL
    GROUP BY 1
    ORDER BY total DESC
    LIMIT 20
  `);

  const sampleMissing = await prisma.student.findMany({
    where: { deletedAt: null, masterProfile: { dateOfBirth: null } },
    take: 10,
    select: {
      rollNumber: true,
      enrollmentNumber: true,
      importSource: true,
      masterProfile: { select: { fullName: true, dateOfBirth: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const samplePresent = await prisma.student.findMany({
    where: { deletedAt: null, masterProfile: { dateOfBirth: { not: null } } },
    take: 5,
    select: {
      rollNumber: true,
      importSource: true,
      masterProfile: { select: { fullName: true, dateOfBirth: true } },
    },
  });

  console.log(
    JSON.stringify(
      {
        totalStudents: total,
        profiles: withProfile,
        withDob,
        withoutDob,
        pctMissing:
          withProfile > 0
            ? Math.round((withoutDob / withProfile) * 1000) / 10
            : null,
        ankitBA24458: ankit,
        byImportSource: byImportSource.map((r) => ({
          importSource: r.import_source,
          total: Number(r.total),
          withDob: Number(r.with_dob),
          missingDob: Number(r.missing_dob),
        })),
        sampleMissing,
        samplePresent,
      },
      null,
      2,
    ),
  );

  const missingImportByBatch = await prisma.$queryRawUnsafe<
    Array<{ batch: string; missing_dob: number }>
  >(`
    SELECT
      COALESCE(b.batch_code, '(no batch)') AS batch,
      COUNT(*)::int AS missing_dob
    FROM academic.students s
    LEFT JOIN academic.student_profiles p ON p.student_id = s.id
    LEFT JOIN academic.student_academic_profiles ap ON ap.student_id = s.id
    LEFT JOIN academic.admission_batches b ON b.id = ap.admission_batch_id
    WHERE s.deleted_at IS NULL
      AND COALESCE(s.import_source, '') = 'IMPORT'
      AND p.date_of_birth IS NULL
    GROUP BY 1
    ORDER BY missing_dob DESC
  `);
  console.log(JSON.stringify({ missingImportByBatch }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
