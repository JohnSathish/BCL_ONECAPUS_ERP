import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import type { StudentReportFiltersDto } from '../dto/student-reports.dto';
import type { SubjectStrengthReport } from '../student-reports.types';
import { StudentReportsQueryService } from './student-reports-query.service';

const CATEGORY_ORDER = [
  'MAJOR',
  'MINOR',
  'MDC',
  'AEC',
  'SEC',
  'VTC',
  'VAC',
] as const;

const ROMAN: Record<number, string> = {
  1: 'I',
  2: 'II',
  3: 'III',
  4: 'IV',
  5: 'V',
  6: 'VI',
  7: 'VII',
  8: 'VIII',
};

type StrengthAggRow = {
  semester_sequence: number;
  category: string;
  offering_id: string;
  course_code: string;
  course_title: string;
  student_count: number;
};

type SemesterHeadcountRow = {
  semester_sequence: number;
  student_count: number;
};

@Injectable()
export class StudentSubjectStrengthReportService {
  constructor(private readonly query: StudentReportsQueryService) {}

  async getReport(
    tenantId: string,
    filters: StudentReportFiltersDto,
    user?: JwtUser,
  ): Promise<SubjectStrengthReport> {
    // Semester filter applies to registration.semesterSequence, not current standing.
    const { semester, ...studentFilters } = filters;
    const where = this.query.buildWhere(tenantId, studentFilters, user);
    const students = await this.query.prisma.student.findMany({
      where,
      select: { id: true },
    });

    if (students.length === 0) {
      return {
        title: 'Subject Strength Report',
        totalEnrollments: 0,
        semesters: [],
      };
    }

    const studentIdSql = Prisma.join(
      students.map((s) => Prisma.sql`${s.id}::uuid`),
    );
    const semesterClause =
      semester != null
        ? Prisma.sql`AND sr.semester_sequence = ${semester}`
        : Prisma.empty;

    const [rows, headcounts] = await Promise.all([
      this.query.prisma.$queryRaw<StrengthAggRow[]>(Prisma.sql`
        SELECT
          sr.semester_sequence AS semester_sequence,
          UPPER(TRIM(srl.category)) AS category,
          srl.offering_id AS offering_id,
          c.code AS course_code,
          c.title AS course_title,
          COUNT(DISTINCT sr.student_id)::int AS student_count
        FROM academic.semester_registration_lines srl
        INNER JOIN academic.semester_registrations sr
          ON sr.id = srl.registration_id
        INNER JOIN academic.course_offerings co
          ON co.id = srl.offering_id
        INNER JOIN academic.courses c
          ON c.id = co.course_id
        WHERE srl.tenant_id = ${tenantId}::uuid
          AND sr.archived_at IS NULL
          AND srl.status IN ('pending', 'confirmed')
          AND sr.student_id IN (${studentIdSql})
          ${semesterClause}
        GROUP BY
          sr.semester_sequence,
          UPPER(TRIM(srl.category)),
          srl.offering_id,
          c.code,
          c.title
        ORDER BY
          sr.semester_sequence ASC,
          c.title ASC
      `),
      this.query.prisma.$queryRaw<SemesterHeadcountRow[]>(Prisma.sql`
        SELECT
          sr.semester_sequence AS semester_sequence,
          COUNT(DISTINCT sr.student_id)::int AS student_count
        FROM academic.semester_registration_lines srl
        INNER JOIN academic.semester_registrations sr
          ON sr.id = srl.registration_id
        WHERE srl.tenant_id = ${tenantId}::uuid
          AND sr.archived_at IS NULL
          AND srl.status IN ('pending', 'confirmed')
          AND sr.student_id IN (${studentIdSql})
          ${semesterClause}
        GROUP BY sr.semester_sequence
      `),
    ]);

    const headcountBySem = new Map(
      headcounts.map((h) => [
        h.semester_sequence,
        Number(h.student_count) || 0,
      ]),
    );

    return this.assemble(rows, headcountBySem);
  }

  private assemble(
    rows: StrengthAggRow[],
    headcountBySem: Map<number, number>,
  ): SubjectStrengthReport {
    const bySemester = new Map<
      number,
      Map<
        string,
        {
          offeringId: string;
          courseCode: string;
          courseTitle: string;
          studentCount: number;
        }[]
      >
    >();

    for (const row of rows) {
      let cats = bySemester.get(row.semester_sequence);
      if (!cats) {
        cats = new Map();
        bySemester.set(row.semester_sequence, cats);
      }
      const cat = (row.category || 'OTHER').toUpperCase();
      const list = cats.get(cat) ?? [];
      list.push({
        offeringId: row.offering_id,
        courseCode: row.course_code,
        courseTitle: row.course_title,
        studentCount: Number(row.student_count) || 0,
      });
      cats.set(cat, list);
    }

    const semesters = [...bySemester.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([semesterSequence, categoriesMap]) => {
        const categories = this.orderedCategories(categoriesMap);
        return {
          semesterSequence,
          label: this.semesterLabel(semesterSequence),
          totalStudents: headcountBySem.get(semesterSequence) ?? 0,
          categories,
        };
      });

    const totalEnrollments = semesters.reduce(
      (sum, s) =>
        sum +
        s.categories.reduce(
          (cs, c) =>
            cs + c.subjects.reduce((ss, sub) => ss + sub.studentCount, 0),
          0,
        ),
      0,
    );

    return {
      title: 'Subject Strength Report',
      totalEnrollments,
      semesters,
    };
  }

  private orderedCategories(
    map: Map<
      string,
      {
        offeringId: string;
        courseCode: string;
        courseTitle: string;
        studentCount: number;
      }[]
    >,
  ) {
    const keys = [...map.keys()].sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a as (typeof CATEGORY_ORDER)[number]);
      const ib = CATEGORY_ORDER.indexOf(b as (typeof CATEGORY_ORDER)[number]);
      const oa = ia === -1 ? 1000 : ia;
      const ob = ib === -1 ? 1000 : ib;
      if (oa !== ob) return oa - ob;
      return a.localeCompare(b);
    });

    return keys.map((category) => {
      const subjects = (map.get(category) ?? []).sort((a, b) =>
        a.courseTitle.localeCompare(b.courseTitle),
      );
      return {
        category,
        label: this.categoryLabel(category),
        subjects,
      };
    });
  }

  categoryLabel(category: string): string {
    const upper = category.toUpperCase();
    if (upper === 'MAJOR') return 'Major';
    if (upper === 'MINOR') return 'Minor';
    return upper;
  }

  semesterLabel(sequence: number): string {
    const roman = ROMAN[sequence] ?? String(sequence);
    return `Semester ${roman}`;
  }
}
