import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import type { StudentReportFiltersDto } from '../dto/student-reports.dto';
import type {
  DepartmentStrengthReport,
  DepartmentStrengthStudentsReport,
  DepartmentSubjectSummaryReport,
} from '../student-reports.types';
import { StudentReportsQueryService } from './student-reports-query.service';

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

const CATEGORY_ORDER = [
  'MAJOR',
  'MINOR',
  'MDC',
  'AEC',
  'SEC',
  'VTC',
  'VAC',
] as const;

type DeptAggRow = {
  department_id: string | null;
  department_name: string;
  major_subject_id: string;
  major_subject_name: string;
  student_count: number;
};

type SummaryAggRow = {
  department_id: string | null;
  department_name: string;
  category: string;
  major_paper_index: number | null;
  course_code: string;
  course_title: string;
  student_count: number;
};

@Injectable()
export class StudentDepartmentStrengthReportService {
  constructor(private readonly query: StudentReportsQueryService) {}

  async getDepartmentReport(
    tenantId: string,
    filters: StudentReportFiltersDto,
    user?: JwtUser,
  ): Promise<DepartmentStrengthReport> {
    const { studentIds, semester, majorDepartmentId, academicYearLabel } =
      await this.resolveCohort(tenantId, filters, user);

    if (studentIds.length === 0) {
      return this.emptyDepartmentReport(filters, academicYearLabel);
    }

    const rows = await this.query.prisma.$queryRaw<DeptAggRow[]>(Prisma.sql`
      SELECT
        maj_subj.department_id AS department_id,
        COALESCE(maj_dept.department_name, maj_subj.name, 'Unassigned') AS department_name,
        track.major_subject_id AS major_subject_id,
        maj_subj.name AS major_subject_name,
        COUNT(DISTINCT sr.student_id)::int AS student_count
      FROM academic.semester_registrations sr
      INNER JOIN academic.semester_registration_lines srl
        ON srl.registration_id = sr.id
      INNER JOIN academic.student_major_minor_tracks track
        ON track.student_id = sr.student_id
      INNER JOIN academic.academic_subjects maj_subj
        ON maj_subj.id = track.major_subject_id
      LEFT JOIN core.departments maj_dept
        ON maj_dept.id = maj_subj.department_id
      WHERE sr.tenant_id = ${tenantId}::uuid
        AND sr.archived_at IS NULL
        AND srl.status IN ('pending', 'confirmed')
        AND sr.student_id IN (${this.idList(studentIds)})
        ${this.semesterClause(semester)}
        ${this.majorDeptClause(majorDepartmentId)}
      GROUP BY
        maj_subj.department_id,
        COALESCE(maj_dept.department_name, maj_subj.name, 'Unassigned'),
        track.major_subject_id,
        maj_subj.name
      ORDER BY
        COALESCE(maj_dept.department_name, maj_subj.name, 'Unassigned') ASC,
        maj_subj.name ASC
    `);

    const mapped = rows.map((r) => ({
      departmentId: r.department_id,
      departmentName: r.department_name,
      majorSubjectId: r.major_subject_id,
      majorSubjectName: r.major_subject_name,
      studentCount: Number(r.student_count) || 0,
    }));

    const totalStudents = mapped.reduce((s, r) => s + r.studentCount, 0);
    const deptIds = new Set(
      mapped.map((r) => r.departmentId ?? r.departmentName),
    );

    return {
      title: 'Department-wise Student Strength Report',
      academicYearLabel,
      semesterLabel:
        semester != null ? this.semesterLabel(semester) : 'All semesters',
      semesterSequence: semester ?? null,
      summary: {
        totalDepartments: deptIds.size,
        totalStudents,
      },
      rows: mapped,
    };
  }

  async getDepartmentStudents(
    tenantId: string,
    filters: StudentReportFiltersDto & {
      majorSubjectId?: string;
      departmentId?: string;
    },
    user?: JwtUser,
  ): Promise<DepartmentStrengthStudentsReport> {
    const majorSubjectId = filters.majorSubjectId;
    if (!majorSubjectId && !filters.departmentId) {
      throw new BadRequestException(
        'majorSubjectId or departmentId is required for the student list',
      );
    }

    const { studentIds, semester, majorDepartmentId, academicYearLabel } =
      await this.resolveCohort(tenantId, filters, user);

    if (studentIds.length === 0) {
      return {
        title: 'Department student list',
        departmentName: '',
        majorSubjectName: '',
        semesterLabel:
          semester != null ? this.semesterLabel(semester) : academicYearLabel,
        total: 0,
        students: [],
      };
    }

    const deptFilter = majorDepartmentId ?? filters.departmentId ?? null;

    const matched = await this.query.prisma.$queryRaw<
      Array<{ student_id: string }>
    >(Prisma.sql`
      SELECT DISTINCT sr.student_id AS student_id
      FROM academic.semester_registrations sr
      INNER JOIN academic.semester_registration_lines srl
        ON srl.registration_id = sr.id
      INNER JOIN academic.student_major_minor_tracks track
        ON track.student_id = sr.student_id
      INNER JOIN academic.academic_subjects maj_subj
        ON maj_subj.id = track.major_subject_id
      WHERE sr.tenant_id = ${tenantId}::uuid
        AND sr.archived_at IS NULL
        AND srl.status IN ('pending', 'confirmed')
        AND sr.student_id IN (${this.idList(studentIds)})
        ${this.semesterClause(semester)}
        ${
          majorSubjectId
            ? Prisma.sql`AND track.major_subject_id = ${majorSubjectId}::uuid`
            : Prisma.empty
        }
        ${this.majorDeptClause(deptFilter)}
    `);

    const ids = matched.map((m) => m.student_id);
    if (ids.length === 0) {
      return {
        title: 'Department student list',
        departmentName: '',
        majorSubjectName: '',
        semesterLabel: semester != null ? this.semesterLabel(semester) : null,
        total: 0,
        students: [],
      };
    }

    const students = await this.query.prisma.student.findMany({
      where: { tenantId, id: { in: ids } },
      select: {
        id: true,
        enrollmentNumber: true,
        rollNumber: true,
        masterProfile: {
          select: {
            fullName: true,
            mobileNumber: true,
            admissionStatus: true,
          },
        },
        majorMinorTrack: {
          select: {
            majorSubject: {
              select: {
                name: true,
                department: { select: { name: true } },
              },
            },
            minorSubject: {
              select: {
                name: true,
                department: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: [{ rollNumber: 'asc' }, { enrollmentNumber: 'asc' }],
    });

    const first = students[0];
    const departmentName =
      first?.majorMinorTrack?.majorSubject?.department?.name ??
      first?.majorMinorTrack?.majorSubject?.name ??
      '';
    const majorSubjectName = first?.majorMinorTrack?.majorSubject?.name ?? '';

    return {
      title: `Students — ${departmentName || majorSubjectName}`,
      departmentName,
      majorSubjectName,
      semesterLabel: semester != null ? this.semesterLabel(semester) : null,
      total: students.length,
      students: students.map((s) => ({
        studentId: s.id,
        enrollmentNumber: s.enrollmentNumber,
        rollNumber: s.rollNumber ?? '',
        fullName: s.masterProfile?.fullName ?? '',
        majorDepartment:
          s.majorMinorTrack?.majorSubject?.department?.name ??
          s.majorMinorTrack?.majorSubject?.name ??
          '',
        minorDepartment:
          s.majorMinorTrack?.minorSubject?.department?.name ??
          s.majorMinorTrack?.minorSubject?.name ??
          '',
        mobileNumber: s.masterProfile?.mobileNumber ?? '',
        admissionStatus: s.masterProfile?.admissionStatus ?? '',
      })),
    };
  }

  async getDepartmentSubjectSummary(
    tenantId: string,
    filters: StudentReportFiltersDto,
    user?: JwtUser,
  ): Promise<DepartmentSubjectSummaryReport> {
    const { studentIds, semester, majorDepartmentId } =
      await this.resolveCohort(tenantId, filters, user);

    if (studentIds.length === 0) {
      return {
        title: 'Department + Subject Summary',
        semesterLabel:
          semester != null ? this.semesterLabel(semester) : 'All semesters',
        departments: [],
      };
    }

    const rows = await this.query.prisma.$queryRaw<SummaryAggRow[]>(Prisma.sql`
      SELECT
        maj_subj.department_id AS department_id,
        COALESCE(maj_dept.department_name, maj_subj.name, 'Unassigned') AS department_name,
        UPPER(TRIM(srl.category)) AS category,
        co.major_paper_index AS major_paper_index,
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
      INNER JOIN academic.student_major_minor_tracks track
        ON track.student_id = sr.student_id
      INNER JOIN academic.academic_subjects maj_subj
        ON maj_subj.id = track.major_subject_id
      LEFT JOIN core.departments maj_dept
        ON maj_dept.id = maj_subj.department_id
      WHERE srl.tenant_id = ${tenantId}::uuid
        AND sr.archived_at IS NULL
        AND srl.status IN ('pending', 'confirmed')
        AND sr.student_id IN (${this.idList(studentIds)})
        ${this.semesterClause(semester)}
        ${this.majorDeptClause(majorDepartmentId)}
      GROUP BY
        maj_subj.department_id,
        COALESCE(maj_dept.department_name, maj_subj.name, 'Unassigned'),
        UPPER(TRIM(srl.category)),
        co.major_paper_index,
        c.code,
        c.title
      ORDER BY
        COALESCE(maj_dept.department_name, maj_subj.name, 'Unassigned') ASC,
        UPPER(TRIM(srl.category)) ASC,
        co.major_paper_index ASC NULLS LAST,
        c.title ASC
    `);

    const byDept = new Map<
      string,
      {
        departmentId: string | null;
        departmentName: string;
        lines: DepartmentSubjectSummaryReport['departments'][0]['lines'];
      }
    >();

    for (const row of rows) {
      const key = row.department_id ?? row.department_name;
      let dept = byDept.get(key);
      if (!dept) {
        dept = {
          departmentId: row.department_id,
          departmentName: row.department_name,
          lines: [],
        };
        byDept.set(key, dept);
      }
      const category = (row.category || 'OTHER').toUpperCase();
      dept.lines.push({
        category,
        categoryLabel: this.categoryLabel(category),
        label: this.lineLabel(
          category,
          row.major_paper_index,
          row.course_title,
        ),
        courseCode: row.course_code,
        courseTitle: row.course_title,
        majorPaperIndex:
          row.major_paper_index == null ? null : Number(row.major_paper_index),
        studentCount: Number(row.student_count) || 0,
      });
    }

    const departments = [...byDept.values()].map((d) => ({
      ...d,
      lines: d.lines.sort((a, b) => {
        const ia = CATEGORY_ORDER.indexOf(
          a.category as (typeof CATEGORY_ORDER)[number],
        );
        const ib = CATEGORY_ORDER.indexOf(
          b.category as (typeof CATEGORY_ORDER)[number],
        );
        const oa = ia === -1 ? 1000 : ia;
        const ob = ib === -1 ? 1000 : ib;
        if (oa !== ob) return oa - ob;
        const pa = a.majorPaperIndex ?? 99;
        const pb = b.majorPaperIndex ?? 99;
        if (pa !== pb) return pa - pb;
        return a.courseTitle.localeCompare(b.courseTitle);
      }),
    }));

    return {
      title: 'Department + Subject Summary',
      semesterLabel:
        semester != null ? this.semesterLabel(semester) : 'All semesters',
      departments,
    };
  }

  private async resolveCohort(
    tenantId: string,
    filters: StudentReportFiltersDto,
    user?: JwtUser,
  ) {
    const { semester, departmentId: majorDepartmentId, ...rest } = filters;
    // departmentId filter = major subject's department (not Student.departmentId)
    const where = this.query.buildWhere(tenantId, rest, user);
    const students = await this.query.prisma.student.findMany({
      where,
      select: { id: true },
    });
    return {
      studentIds: students.map((s) => s.id),
      semester: semester ?? null,
      majorDepartmentId: majorDepartmentId ?? null,
      academicYearLabel: filters.academicYear?.trim() || null,
    };
  }

  private emptyDepartmentReport(
    filters: StudentReportFiltersDto,
    academicYearLabel: string | null,
  ): DepartmentStrengthReport {
    return {
      title: 'Department-wise Student Strength Report',
      academicYearLabel,
      semesterLabel:
        filters.semester != null
          ? this.semesterLabel(filters.semester)
          : 'All semesters',
      semesterSequence: filters.semester ?? null,
      summary: { totalDepartments: 0, totalStudents: 0 },
      rows: [],
    };
  }

  private idList(ids: string[]) {
    return Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`));
  }

  private semesterClause(semester: number | null) {
    return semester != null
      ? Prisma.sql`AND sr.semester_sequence = ${semester}`
      : Prisma.empty;
  }

  private majorDeptClause(departmentId: string | null) {
    return departmentId
      ? Prisma.sql`AND maj_subj.department_id = ${departmentId}::uuid`
      : Prisma.empty;
  }

  semesterLabel(sequence: number): string {
    return `Semester ${ROMAN[sequence] ?? String(sequence)}`;
  }

  categoryLabel(category: string): string {
    const upper = category.toUpperCase();
    if (upper === 'MAJOR') return 'Major';
    if (upper === 'MINOR') return 'Minor';
    return upper;
  }

  private lineLabel(
    category: string,
    majorPaperIndex: number | null,
    courseTitle: string,
  ): string {
    const upper = category.toUpperCase();
    if (upper === 'MAJOR' && majorPaperIndex != null) {
      return `Major ${ROMAN[majorPaperIndex] ?? majorPaperIndex}`;
    }
    if (upper === 'MAJOR') return `Major – ${courseTitle}`;
    if (upper === 'MINOR') return `Minor – ${courseTitle}`;
    return `${this.categoryLabel(upper)} – ${courseTitle}`;
  }
}
