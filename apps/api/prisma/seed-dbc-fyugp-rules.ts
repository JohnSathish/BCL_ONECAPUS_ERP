import type { PrismaClient } from '@prisma/client';
import { slugifySubject } from '../src/modules/academic-engine/domain/nep-categories';
import {
  DBC_MAJOR_MINOR_DEPT_CODE,
  DBC_MAJOR_MINOR_MATRIX,
  DBC_MAJOR_MINOR_PROGRAMME_GROUP,
} from '../src/modules/academic-engine/domain/dbc-major-minor-matrix';

export { DBC_MAJOR_MINOR_MATRIX } from '../src/modules/academic-engine/domain/dbc-major-minor-matrix';

export async function seedDbcFyugpRules(
  prisma: PrismaClient,
  tenantId: string,
  institutionId: string,
) {
  const departments = await prisma.department.findMany({
    where: { tenantId, institutionId, deletedAt: null },
    select: { id: true, code: true, name: true },
  });
  const deptByCode = new Map(departments.map((d) => [d.code, d.id]));

  const subjectIds = new Map<string, string>();

  const allSubjectNames = new Set<string>();
  for (const [major, minors] of Object.entries(DBC_MAJOR_MINOR_MATRIX)) {
    allSubjectNames.add(major);
    for (const m of minors) allSubjectNames.add(m);
  }

  for (const name of allSubjectNames) {
    const slug = slugifySubject(name);
    const deptCode = DBC_MAJOR_MINOR_DEPT_CODE[name];
    const departmentId = deptCode ? deptByCode.get(deptCode) : undefined;

    const row = await prisma.academicSubject.upsert({
      where: { tenantId_slug: { tenantId, slug } },
      update: {},
      create: {
        tenantId,
        institutionId,
        slug,
        name,
        departmentId: departmentId ?? null,
        programmeGroup: DBC_MAJOR_MINOR_PROGRAMME_GROUP[name] ?? null,
        isActive: true,
      },
    });
    subjectIds.set(name, row.id);
  }

  for (const [majorName, minorNames] of Object.entries(
    DBC_MAJOR_MINOR_MATRIX,
  )) {
    const majorSubjectId = subjectIds.get(majorName);
    if (!majorSubjectId) continue;

    for (const minorName of minorNames) {
      const allowedMinorSubjectId = subjectIds.get(minorName);
      if (!allowedMinorSubjectId) continue;

      const existing = await prisma.majorMinorRule.findFirst({
        where: {
          tenantId,
          majorSubjectId,
          allowedMinorSubjectId,
          academicYearId: null,
        },
      });

      if (existing) {
        await prisma.majorMinorRule.update({
          where: { id: existing.id },
          data: { isActive: true },
        });
      } else {
        await prisma.majorMinorRule.create({
          data: {
            tenantId,
            majorSubjectId,
            allowedMinorSubjectId,
            isActive: true,
          },
        });
      }
    }
  }

  return { subjectCount: subjectIds.size };
}
