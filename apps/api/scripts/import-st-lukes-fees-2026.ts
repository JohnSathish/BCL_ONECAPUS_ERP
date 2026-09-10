import { PrismaClient } from '@prisma/client';
import { FEE_2026_GROUPS } from '../src/modules/school-sis/school-sis-fee-2026.catalog';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: 'st-lukes-tura' },
  });
  if (!tenant) throw new Error('st-lukes-tura tenant missing');
  const year = await prisma.schoolAcademicYear.findFirst({
    where: { tenantId: tenant.id, deletedAt: null, status: 'CURRENT' },
  });
  if (!year) throw new Error('No CURRENT school academic year');
  const grades = await prisma.schoolGrade.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
  });
  const byCode = new Map(grades.map((g) => [g.code, g]));
  let created = 0;
  for (const group of FEE_2026_GROUPS) {
    for (const gradeCode of group.gradeCodes) {
      const grade = byCode.get(gradeCode);
      if (!grade) {
        console.log('skip missing grade', gradeCode);
        continue;
      }
      const existing = await prisma.schoolFeeStructure.findFirst({
        where: {
          tenantId: tenant.id,
          academicYearId: year.id,
          gradeId: grade.id,
          code: group.code,
        },
      });
      if (existing) continue;
      await prisma.schoolFeeStructure.create({
        data: {
          tenantId: tenant.id,
          academicYearId: year.id,
          gradeId: grade.id,
          code: group.code,
          name: `${grade.name} · ${group.name}`,
          status: 'PUBLISHED',
          sourceLabel: 'St_Lukes_Fee_Structure_2026.xlsx',
          notesJson: group.notes,
          lines: {
            create: group.lines.map((line) => ({
              tenantId: tenant.id,
              kind: line.kind,
              code: line.code,
              label: line.label,
              amount: line.amount,
              unspecified: Boolean(line.unspecified),
              remarks: line.remarks ?? null,
              sortOrder: line.sortOrder,
            })),
          },
        },
      });
      created += 1;
      console.log('created', grade.name, group.code);
    }
  }
  const count = await prisma.schoolFeeStructure.count({
    where: { tenantId: tenant.id, academicYearId: year.id },
  });
  console.log(
    `done created=${created} totalStructures=${count} year=${year.name}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
