/**
 * One-off: set student.departmentId from programme-linked academic department
 * when the student currently has no department.
 *
 * Run from apps/api:
 *   npx tsx scripts/backfill-student-departments-from-programme.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function isAcademicDepartment(departmentType: string | null | undefined) {
  if (!departmentType) return true;
  return departmentType !== 'ADMINISTRATIVE';
}

async function main() {
  const tenants = await prisma.tenant.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, slug: true },
  });

  let totalUpdated = 0;
  let totalEligible = 0;
  let totalSkippedNoProgramme = 0;
  let totalSkippedNoDept = 0;
  let totalSkippedNonAcademic = 0;

  for (const tenant of tenants) {
    const students = await prisma.student.findMany({
      where: { tenantId: tenant.id, deletedAt: null, departmentId: null },
      select: {
        id: true,
        enrollmentNumber: true,
        rollNumber: true,
        programVersionId: true,
        masterProfile: { select: { fullName: true } },
        programVersion: {
          select: {
            program: {
              select: {
                code: true,
                name: true,
                departmentId: true,
                department: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    departmentType: true,
                    deletedAt: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const byDept = new Map<string, { label: string; studentIds: string[] }>();
    let skippedNoProgramme = 0;
    let skippedNoDept = 0;
    let skippedNonAcademic = 0;

    for (const student of students) {
      const program = student.programVersion?.program;
      if (!student.programVersionId || !program) {
        skippedNoProgramme += 1;
        continue;
      }
      const linked = program.department;
      if (!program.departmentId || !linked || linked.deletedAt) {
        skippedNoDept += 1;
        continue;
      }
      if (!isAcademicDepartment(linked.departmentType)) {
        skippedNonAcademic += 1;
        continue;
      }
      const label = linked.name ?? linked.code;
      const bucket = byDept.get(linked.id) ?? { label, studentIds: [] };
      bucket.studentIds.push(student.id);
      byDept.set(linked.id, bucket);
    }

    let updated = 0;
    for (const [departmentId, bucket] of byDept) {
      const result = await prisma.student.updateMany({
        where: {
          tenantId: tenant.id,
          id: { in: bucket.studentIds },
          departmentId: null,
          deletedAt: null,
        },
        data: { departmentId },
      });
      updated += result.count;

      if (result.count > 0) {
        await prisma.academicChangeHistory.createMany({
          data: bucket.studentIds.slice(0, result.count).map((studentId) => ({
            tenantId: tenant.id,
            studentId,
            changeType: 'DEPARTMENT_CHANGED',
            fieldName: 'department',
            oldValue: null,
            newValue: bucket.label,
            changedByName: 'System',
            changedByRole: 'script',
            reason:
              'Backfill department from programme-linked academic department',
          })),
        });
      }
    }

    const eligible = [...byDept.values()].reduce(
      (n, b) => n + b.studentIds.length,
      0,
    );
    totalUpdated += updated;
    totalEligible += eligible;
    totalSkippedNoProgramme += skippedNoProgramme;
    totalSkippedNoDept += skippedNoDept;
    totalSkippedNonAcademic += skippedNonAcademic;

    console.log(
      `[${tenant.slug ?? tenant.id}] missing=${students.length} eligible=${eligible} updated=${updated} noProgramme=${skippedNoProgramme} programmeNoDept=${skippedNoDept} nonAcademic=${skippedNonAcademic}`,
    );
    for (const [departmentId, bucket] of byDept) {
      console.log(
        `  → ${bucket.label} (${departmentId.slice(0, 8)}…): ${bucket.studentIds.length}`,
      );
    }
  }

  console.log('\nDone.');
  console.log(
    JSON.stringify(
      {
        totalEligible,
        totalUpdated,
        totalSkippedNoProgramme,
        totalSkippedNoDept,
        totalSkippedNonAcademic,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
