import type { PrismaClient } from '@prisma/client';
import { slugifySubject } from '../src/modules/academic-engine/domain/nep-categories';

/** Don Bosco College official major → allowed minors matrix. */
export const DBC_MAJOR_MINOR_MATRIX: Record<string, string[]> = {
  Economics: ['Geography', 'History', 'Political Science', 'Sociology'],
  Education: ['Garo', 'History', 'Philosophy'],
  English: ['Education', 'Geography', 'Philosophy', 'Political Science'],
  Garo: ['Education', 'Geography', 'Philosophy', 'Sociology'],
  Geography: ['Economics', 'Garo'],
  History: ['Economics', 'Philosophy', 'Political Science', 'Sociology'],
  Philosophy: ['Education', 'Garo', 'Geography'],
  'Political Science': ['Economics', 'Education', 'History', 'Sociology'],
  Sociology: ['Economics', 'Garo', 'History', 'Political Science'],
  Botany: ['Zoology', 'Chemistry'],
  Chemistry: ['Mathematics', 'Physics'],
  Mathematics: ['Physics', 'Chemistry'],
  Zoology: ['Botany', 'Chemistry'],
  Physics: ['Chemistry', 'Mathematics'],
  'Accounting For Business': ['Economics', 'Mathematics', 'Geography'],
};

const SUBJECT_PROGRAMME_GROUP: Record<string, string> = {
  Economics: 'ARTS',
  Education: 'ARTS',
  English: 'ARTS',
  Garo: 'ARTS',
  Geography: 'ARTS',
  History: 'ARTS',
  Philosophy: 'ARTS',
  'Political Science': 'ARTS',
  Sociology: 'ARTS',
  Botany: 'SCIENCE',
  Chemistry: 'SCIENCE',
  Mathematics: 'SCIENCE',
  Zoology: 'SCIENCE',
  Physics: 'SCIENCE',
  'Accounting For Business': 'COMMERCE',
};

const DEPT_CODE_BY_NAME: Record<string, string> = {
  Economics: 'ECO',
  Education: 'EDU',
  English: 'ENG',
  Garo: 'GAR',
  Geography: 'GEO',
  History: 'HIS',
  Philosophy: 'PHI',
  'Political Science': 'POL',
  Sociology: 'SOC',
  Botany: 'BOT',
  Chemistry: 'CHE',
  Mathematics: 'MTH',
  Zoology: 'ZOO',
  Physics: 'PHY',
  'Accounting For Business': 'AFB',
};

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
    const deptCode = DEPT_CODE_BY_NAME[name];
    const departmentId = deptCode ? deptByCode.get(deptCode) : undefined;

    const row = await prisma.academicSubject.upsert({
      where: { tenantId_slug: { tenantId, slug } },
      update: {
        name,
        departmentId: departmentId ?? null,
        programmeGroup: SUBJECT_PROGRAMME_GROUP[name] ?? null,
        isActive: true,
        deletedAt: null,
      },
      create: {
        tenantId,
        institutionId,
        slug,
        name,
        departmentId: departmentId ?? null,
        programmeGroup: SUBJECT_PROGRAMME_GROUP[name] ?? null,
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
