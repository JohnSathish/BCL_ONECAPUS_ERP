import { Injectable } from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import type { StudentReportFiltersDto } from '../dto/student-reports.dto';
import { StudentReportsQueryService } from './student-reports-query.service';

const NEP_CATEGORIES = [
  'MAJOR',
  'MINOR',
  'MDC',
  'AEC',
  'SEC',
  'VTC',
  'VAC',
] as const;
const SUMMARY_COLUMNS = [
  { key: 'rollNumber', label: 'Roll Number' },
  { key: 'fullName', label: 'Full Name' },
  { key: 'batch', label: 'Batch' },
  { key: 'currentSemester', label: 'Semester' },
  { key: 'major', label: 'Major' },
  { key: 'minor', label: 'Minor' },
  { key: 'mdc', label: 'MDC' },
  { key: 'aec', label: 'AEC' },
  { key: 'sec', label: 'SEC' },
  { key: 'vtc', label: 'VTC' },
];

const PAPER_COLUMNS = [
  { key: 'rollNumber', label: 'Roll Number' },
  { key: 'fullName', label: 'Full Name' },
  { key: 'batch', label: 'Batch' },
  { key: 'currentSemester', label: 'Semester' },
  { key: 'majorPaper1', label: 'Major Paper 1' },
  { key: 'majorPaper2', label: 'Major Paper 2' },
  { key: 'majorPaper3', label: 'Major Paper 3' },
  { key: 'majorPaper4', label: 'Major Paper 4' },
  { key: 'minor', label: 'Minor' },
  { key: 'mdc', label: 'MDC' },
  { key: 'aec', label: 'AEC' },
  { key: 'sec', label: 'SEC' },
  { key: 'vtc', label: 'VTC' },
];

const ROW_LIMIT = 10_000;

type RegistrationLine = {
  category: string;
  offering: {
    majorPaperIndex: number | null;
    course: {
      code: string;
      title: string;
      department: { name: string } | null;
    };
  };
};

@Injectable()
export class StudentSubjectReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly query: StudentReportsQueryService,
  ) {}

  async subjectSummary(
    tenantId: string,
    filters: StudentReportFiltersDto,
    user?: JwtUser,
  ) {
    const { students, total, truncated } =
      await this.loadStudentsWithRegistrations(tenantId, filters, user);
    const rows = students.map((student) => {
      const reg = this.pickRegistration(student, filters.semester);
      const buckets = this.bucketLines(reg?.lines ?? []);
      return {
        rollNumber: student.rollNumber ?? student.enrollmentNumber,
        fullName: student.masterProfile?.fullName ?? '',
        batch: student.academicProfile?.admissionBatch?.batchCode ?? '',
        currentSemester:
          reg?.semesterSequence ??
          student.academicStanding?.currentSemesterSequence ??
          '',
        major: buckets.major,
        minor: buckets.minor,
        mdc: buckets.mdc,
        aec: buckets.aec,
        sec: buckets.sec,
        vtc: buckets.vtc || buckets.vac,
      };
    });

    return {
      total,
      truncated,
      rowCount: rows.length,
      columns: SUMMARY_COLUMNS,
      rows,
    };
  }

  async subjectPapers(
    tenantId: string,
    filters: StudentReportFiltersDto,
    user?: JwtUser,
  ) {
    const { students, total, truncated } =
      await this.loadStudentsWithRegistrations(tenantId, filters, user);
    const rows = students.map((student) => {
      const reg = this.pickRegistration(student, filters.semester);
      const papers = this.paperBuckets(reg?.lines ?? []);
      return {
        rollNumber: student.rollNumber ?? student.enrollmentNumber,
        fullName: student.masterProfile?.fullName ?? '',
        batch: student.academicProfile?.admissionBatch?.batchCode ?? '',
        currentSemester:
          reg?.semesterSequence ??
          student.academicStanding?.currentSemesterSequence ??
          '',
        ...papers,
      };
    });

    return {
      total,
      truncated,
      rowCount: rows.length,
      columns: PAPER_COLUMNS,
      rows,
    };
  }

  private async loadStudentsWithRegistrations(
    tenantId: string,
    filters: StudentReportFiltersDto,
    user?: JwtUser,
  ) {
    const where = this.query.buildWhere(tenantId, filters, user);
    const [total, students] = await Promise.all([
      this.prisma.student.count({ where }),
      this.prisma.student.findMany({
        where,
        include: {
          masterProfile: { select: { fullName: true } },
          academicProfile: {
            include: {
              admissionBatch: { select: { batchCode: true } },
            },
          },
          academicStanding: { select: { currentSemesterSequence: true } },
          semesterRegistrations: {
            where: {
              archivedAt: null,
              ...(filters.semester
                ? { semesterSequence: filters.semester }
                : {}),
            },
            include: {
              lines: {
                include: {
                  offering: {
                    include: {
                      course: {
                        include: {
                          department: { select: { name: true } },
                        },
                      },
                    },
                  },
                },
              },
            },
            orderBy: { semesterSequence: 'desc' },
          },
        },
        orderBy: [{ rollNumber: 'asc' }, { enrollmentNumber: 'asc' }],
        take: ROW_LIMIT,
      }),
    ]);

    return { students, total, truncated: total > ROW_LIMIT };
  }

  private pickRegistration(
    student: {
      semesterRegistrations: {
        semesterSequence: number;
        lines: RegistrationLine[];
      }[];
      academicStanding: { currentSemesterSequence: number } | null;
    },
    semester?: number,
  ) {
    const regs = student.semesterRegistrations;
    if (!regs.length) return null;
    if (semester)
      return regs.find((r) => r.semesterSequence === semester) ?? regs[0];
    const current = student.academicStanding?.currentSemesterSequence;
    if (current) {
      const match = regs.find((r) => r.semesterSequence === current);
      if (match) return match;
    }
    return regs[0];
  }

  private bucketLines(lines: RegistrationLine[]) {
    const result = {
      major: '',
      minor: '',
      mdc: '',
      aec: '',
      sec: '',
      vtc: '',
      vac: '',
    };
    const grouped = new Map<string, Set<string>>();

    for (const line of lines) {
      const cat = this.normalizeCategory(line.category);
      if (!cat) continue;
      const dept =
        line.offering.course.department?.name ??
        line.offering.course.title ??
        '';
      if (!dept) continue;
      if (!grouped.has(cat)) grouped.set(cat, new Set());
      grouped.get(cat)!.add(dept);
    }

    for (const cat of NEP_CATEGORIES) {
      const key = cat.toLowerCase() as keyof typeof result;
      if (!(key in result)) continue;
      const values = grouped.get(cat);
      if (values?.size) result[key] = [...values].join('; ');
    }

    return result;
  }

  private paperBuckets(lines: RegistrationLine[]) {
    const majors = new Map<number, string>();
    const singles: Record<string, string> = {
      minor: '',
      mdc: '',
      aec: '',
      sec: '',
      vtc: '',
    };

    for (const line of lines) {
      const cat = this.normalizeCategory(line.category);
      if (!cat) continue;
      const label = this.paperLabel(line);
      if (cat === 'MAJOR') {
        const idx = line.offering.majorPaperIndex ?? majors.size + 1;
        majors.set(idx, label);
      } else if (cat === 'VAC' || cat === 'VTC') {
        singles.vtc = singles.vtc ? `${singles.vtc}; ${label}` : label;
      } else {
        const key = cat.toLowerCase();
        if (key in singles) {
          singles[key] = singles[key] ? `${singles[key]}; ${label}` : label;
        }
      }
    }

    return {
      majorPaper1: majors.get(1) ?? '',
      majorPaper2: majors.get(2) ?? '',
      majorPaper3: majors.get(3) ?? '',
      majorPaper4: majors.get(4) ?? '',
      ...singles,
    };
  }

  private paperLabel(line: RegistrationLine) {
    const { code, title } = line.offering.course;
    return `${code} — ${title}`;
  }

  private normalizeCategory(category: string) {
    const upper = category.toUpperCase();
    if (NEP_CATEGORIES.includes(upper as (typeof NEP_CATEGORIES)[number])) {
      return upper;
    }
    return '';
  }
}
