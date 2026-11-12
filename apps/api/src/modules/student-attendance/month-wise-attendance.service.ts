import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { getZonedDateKey } from '../../common/utils/time-greeting';
import { WorkingDayEngineService } from '../academic-calendar/working-day-engine.service';
import {
  attendanceEnrollmentNumber,
  attendanceRollNumber,
  resolveStudentFullName,
} from './attendance-display.util';
import { AttendancePolicyService } from './attendance-policy.service';
import { classifyAttendanceSession } from './attendance-report.util';
import { compareAttendanceRoll } from './attendance-roll-order.util';
import { loadAttendanceStudents } from './attendance-student-lookup';
import type { AttendanceReportQueryDto } from './dto/student-attendance.dto';
import {
  buildMonthWiseExcel,
  buildMonthWisePdf,
  type MonthWiseExportModel,
} from './month-wise-attendance.export';
import {
  monthRangeBounds,
  summarizeMonthWise,
  type MonthWiseMark,
} from './month-wise-attendance.logic';

const SESSION_PAGE = 2000;
const MAX_SESSIONS = 12000;

type CompactSession = {
  id: string;
  dateKey: string;
  monthKey: string;
  status: string;
  periodNo: number | null;
  courseId: string | null;
  groupId: string | null;
  sectionId: string | null;
  semesterNo: number | null;
  collectionUnit: string | null;
  role: 'conducted' | 'scheduled' | 'cancelled' | 'excluded';
};

@Injectable()
export class MonthWiseAttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendancePolicy: AttendancePolicyService,
    private readonly workingDays: WorkingDayEngineService,
  ) {}

  async options(tenantId: string) {
    const sections = await this.prisma.offeringSection.findMany({
      where: { tenantId, deletedAt: null },
      select: {
        id: true,
        sectionCode: true,
        courseOffering: {
          select: {
            semesterSequence: true,
            course: { select: { code: true, title: true } },
          },
        },
      },
      orderBy: { sectionCode: 'asc' },
      take: 500,
    });
    return {
      sections: sections.map((section) => ({
        id: section.id,
        label: [
          section.sectionCode ? `Section ${section.sectionCode}` : '',
          section.courseOffering?.course?.code,
          section.courseOffering?.semesterSequence
            ? `Sem ${section.courseOffering.semesterSequence}`
            : '',
        ]
          .filter(Boolean)
          .join(' · '),
      })),
    };
  }

  async report(tenantId: string, query: AttendanceReportQueryDto) {
    const built = await this.build(tenantId, query);
    const format = query.format ?? 'json';
    if (format === 'json') return built;
    const presented = this.present(built, undefined, 'All students');
    if (format === 'csv') return this.toCsv(presented);
    if (format === 'pdf') return buildMonthWisePdf(presented);
    return buildMonthWiseExcel(presented);
  }

  async exportReport(
    tenantId: string,
    query: AttendanceReportQueryDto & {
      format: 'xlsx' | 'pdf';
      studentIds?: string[];
      attendanceFilter?: string;
    },
  ) {
    const built = await this.build(tenantId, query);
    const presented = this.present(
      built,
      query.studentIds,
      query.attendanceFilter,
    );
    if (query.format === 'pdf') return buildMonthWisePdf(presented);
    return buildMonthWiseExcel(presented);
  }

  private async build(tenantId: string, query: AttendanceReportQueryDto) {
    let bounds: ReturnType<typeof monthRangeBounds>;
    try {
      bounds = monthRangeBounds(query.fromMonth ?? '', query.toMonth ?? '');
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Choose a valid month range.',
      );
    }
    const policy = await this.attendancePolicy.getOrCreate(tenantId);
    const attendanceType = query.attendanceType ?? 'policy';
    const aggregation =
      attendanceType === 'day' ||
      (attendanceType === 'policy' && policy.aggregationUnit === 'DAY')
        ? 'day'
        : 'period';
    const allShifts = query.allShifts === 'true' || query.allShifts === '1';

    const where: Record<string, unknown> = {
      tenantId,
      deletedAt: null,
      sessionDate: { gte: bounds.from, lte: bounds.to },
    };
    if (query.academicYearId) where.academicYearId = query.academicYearId;
    if (!allShifts && query.shiftId) where.shiftId = query.shiftId;
    if (query.semesterNo) where.semesterNo = query.semesterNo;
    if (query.offeringSectionId)
      where.offeringSectionId = query.offeringSectionId;
    if (query.courseId) where.courseId = query.courseId;
    if (query.staffProfileId) where.primaryFacultyId = query.staffProfileId;
    if (query.departmentId) {
      const [courses, groups] = await Promise.all([
        this.prisma.course.findMany({
          where: {
            tenantId,
            departmentId: query.departmentId,
            deletedAt: null,
          },
          select: { id: true },
        }),
        this.prisma.teachingSubjectGroup.findMany({
          where: {
            tenantId,
            departmentId: query.departmentId,
            deletedAt: null,
          },
          select: { id: true },
        }),
      ]);
      where.OR = [
        { courseId: { in: courses.map((row) => row.id) } },
        { teachingSubjectGroupId: { in: groups.map((row) => row.id) } },
      ];
    }

    const fromKey = bounds.from.toISOString().slice(0, 10);
    const toKey = bounds.to.toISOString().slice(0, 10);
    const calendarDays = await this.workingDays.resolveRange(
      tenantId,
      fromKey,
      toKey,
      {
        mergePublishedCalendars: true,
      },
    );
    const blocked = new Set(
      calendarDays
        .filter((day) => !day.isWorkingDay && !day.createsAttendanceSession)
        .map((day) => day.date),
    );

    const sessions: CompactSession[] = [];
    let truncated = false;
    for (let skip = 0; skip < MAX_SESSIONS; skip += SESSION_PAGE) {
      const page = await this.prisma.studentAttendanceSession.findMany({
        where,
        select: {
          id: true,
          sessionDate: true,
          status: true,
          periodNo: true,
          courseId: true,
          teachingSubjectGroupId: true,
          offeringSectionId: true,
          semesterNo: true,
          metadata: true,
        },
        orderBy: [{ sessionDate: 'asc' }, { periodNo: 'asc' }],
        skip,
        take: SESSION_PAGE,
      });
      for (const session of page) {
        const dateKey = getZonedDateKey(new Date(session.sessionDate));
        sessions.push({
          id: session.id,
          dateKey,
          monthKey: dateKey.slice(0, 7),
          status: session.status,
          periodNo: session.periodNo == null ? null : Number(session.periodNo),
          courseId: session.courseId ?? null,
          groupId: session.teachingSubjectGroupId ?? null,
          sectionId: session.offeringSectionId ?? null,
          semesterNo:
            session.semesterNo == null ? null : Number(session.semesterNo),
          collectionUnit:
            (session.metadata as { collectionUnit?: string | null } | null)
              ?.collectionUnit ?? null,
          role: classifyAttendanceSession({
            sessionStatus: session.status,
            blockedCalendarDay: blocked.has(dateKey),
            relocatedOrForced: false,
          }),
        });
      }
      if (page.length < SESSION_PAGE) break;
      if (skip + SESSION_PAGE >= MAX_SESSIONS) truncated = true;
    }

    const periodsByDate = new Map<string, number[]>();
    for (const session of sessions) {
      if (!session.periodNo) continue;
      const list = periodsByDate.get(session.dateKey) ?? [];
      list.push(session.periodNo);
      periodsByDate.set(session.dateKey, list);
    }
    const countable = (session: CompactSession) =>
      attendanceType === 'period' ||
      this.attendancePolicy.isEntryCountable({
        mode: policy.attendanceMode,
        periodNo: session.periodNo,
        teachingPeriodNos: periodsByDate.get(session.dateKey) ?? [],
        collectionUnit: session.collectionUnit,
      });

    const conducted = sessions.filter(
      (session) => session.role === 'conducted',
    );
    const chosen = this.chooseSessions(conducted, aggregation, countable);
    const entries = await this.loadEntries(
      tenantId,
      chosen.map((session) => session.id),
    );
    const chosenById = new Map(chosen.map((session) => [session.id, session]));
    const marks: MonthWiseMark[] = [];
    const seen = new Set<string>();
    for (const entry of entries) {
      const session = chosenById.get(entry.sessionId);
      if (!session || !entry.studentId) continue;
      const classKey = this.classKey(session, aggregation);
      const dedupe = `${entry.studentId}|${classKey}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      marks.push({
        studentId: entry.studentId,
        monthKey: session.monthKey,
        classKey,
        status: entry.status,
      });
    }

    const summary = summarizeMonthWise({
      months: bounds.columns,
      marks,
      conductedKeys: chosen.map((session) => ({
        monthKey: session.monthKey,
        classKey: this.classKey(session, aggregation),
      })),
    });

    const studentIds = summary.rows.map((row) => row.studentId);
    const [students, context, programmeStudents] = await Promise.all([
      loadAttendanceStudents(this.prisma, tenantId, studentIds),
      this.studentContext(tenantId, studentIds),
      query.programId
        ? this.studentsInProgramme(tenantId, query.programId, studentIds)
        : Promise.resolve(null),
    ]);

    const rows = summary.rows
      .filter((row) => {
        if (!programmeStudents) return true;
        const student = students.get(row.studentId);
        return (
          programmeStudents.has(row.studentId) ||
          (student ? programmeStudents.has(student.id) : false)
        );
      })
      .map((row) => {
        const student = students.get(row.studentId);
        const extra = context.get(student?.id ?? row.studentId);
        const rollNumber = attendanceRollNumber(student);
        const enrollmentNumber = attendanceEnrollmentNumber(student);
        return {
          studentId: student?.id ?? row.studentId,
          fullName: resolveStudentFullName(student),
          rollNumber,
          enrollmentNumber,
          departmentName: extra?.departmentName ?? null,
          programmeName: extra?.programmeName ?? null,
          semesterNo: extra?.semesterNo ?? null,
          months: row.months,
          overall: row.overall,
          overallDisplay: row.overall.display,
          overallPercentage: row.overall.percentage,
          ...Object.fromEntries(
            row.months.map((month) => [`month_${month.key}`, month.display]),
          ),
        };
      })
      .sort(compareAttendanceRoll);

    const filters = await this.filterLabels(tenantId, query);
    const conductedTotal = summary.months.reduce(
      (sum, month) => sum + month.conducted,
      0,
    );
    return {
      type: 'month-wise',
      institutionName: filters.institutionName,
      academicYear: filters.academicYear,
      programme: filters.programme,
      department: filters.department,
      semester: query.semesterNo ? `Semester ${query.semesterNo}` : null,
      section: filters.section,
      subject: filters.subject,
      shift: allShifts ? 'All shifts' : filters.shift,
      from: fromKey,
      to: toKey,
      fromMonth: bounds.columns[0]?.label ?? query.fromMonth,
      toMonth:
        bounds.columns[bounds.columns.length - 1]?.label ?? query.toMonth,
      monthRange: `${bounds.columns[0]?.label ?? ''} to ${bounds.columns[bounds.columns.length - 1]?.label ?? ''}`,
      generatedAt: new Date().toISOString(),
      attendanceMode: policy.attendanceMode,
      attendanceType,
      calculation:
        'Percentage = (Present + approved leave + on duty) ÷ classes officially marked. Holidays, cancelled classes, and unmarked sessions are not conducted. Overall percentage uses those totals, not an average of the months. A month with no marks for the student is N/A.',
      truncated,
      months: summary.months,
      summary: {
        students: rows.length,
        conductedClasses: conductedTotal,
        ...Object.fromEntries(
          summary.months.map((month) => [
            `conducted_${month.key}`,
            month.conducted,
          ]),
        ),
      },
      rows,
      exportColumns: [
        { key: 'rollNumber', label: 'Roll No' },
        { key: 'fullName', label: 'Student Name' },
        ...summary.months.map((month) => ({
          key: `month_${month.key}`,
          label: month.label,
        })),
        { key: 'overallDisplay', label: 'Overall' },
      ],
    };
  }

  private chooseSessions(
    conducted: CompactSession[],
    aggregation: 'day' | 'period',
    countable: (session: CompactSession) => boolean,
  ) {
    if (aggregation === 'period') {
      return conducted.filter((session) => countable(session));
    }
    const groups = new Map<string, CompactSession[]>();
    for (const session of conducted) {
      const key = this.classKey(session, 'day');
      const list = groups.get(key) ?? [];
      list.push(session);
      groups.set(key, list);
    }
    const chosen: CompactSession[] = [];
    for (const list of groups.values()) {
      const preferred = list.filter((session) => countable(session));
      const pool = (preferred.length ? preferred : list)
        .slice()
        .sort((left, right) => (left.periodNo ?? 0) - (right.periodNo ?? 0));
      chosen.push(pool[0]);
    }
    return chosen;
  }

  private classKey(session: CompactSession, aggregation: 'day' | 'period') {
    if (aggregation === 'period') return session.id;
    return `${session.dateKey}|${session.courseId ?? session.groupId ?? 'class'}|${session.sectionId ?? ''}`;
  }

  private async loadEntries(tenantId: string, sessionIds: string[]) {
    const entries: Array<{
      sessionId: string;
      studentId: string;
      status: string;
    }> = [];
    for (let index = 0; index < sessionIds.length; index += 400) {
      const chunk = sessionIds.slice(index, index + 400);
      const rows = await this.prisma.studentAttendanceEntry.findMany({
        where: { tenantId, sessionId: { in: chunk } },
        select: { sessionId: true, studentId: true, status: true },
      });
      entries.push(...rows);
    }
    return entries;
  }

  private async studentsInProgramme(
    tenantId: string,
    programId: string,
    studentIds: string[],
  ) {
    const versions = await this.prisma.programVersion.findMany({
      where: { tenantId, programId },
      select: { id: true },
    });
    const versionIds = versions.map((row) => row.id);
    const allowed = new Set<string>();
    if (!versionIds.length || !studentIds.length) return allowed;
    for (let index = 0; index < studentIds.length; index += 400) {
      const chunk = studentIds.slice(index, index + 400);
      const rows = await this.prisma.student.findMany({
        where: {
          tenantId,
          programVersionId: { in: versionIds },
          OR: [{ id: { in: chunk } }, { userId: { in: chunk } }],
          accountType: { in: ['NORMAL', 'DEMO'] },
        },
        select: { id: true, userId: true },
      });
      for (const row of rows) {
        allowed.add(row.id);
        allowed.add(row.userId);
      }
    }
    return allowed;
  }

  private async studentContext(tenantId: string, studentIds: string[]) {
    const map = new Map<
      string,
      {
        departmentName: string | null;
        programmeName: string | null;
        semesterNo: number | null;
      }
    >();
    for (let index = 0; index < studentIds.length; index += 400) {
      const chunk = studentIds.slice(index, index + 400);
      const rows = await this.prisma.student.findMany({
        where: {
          tenantId,
          OR: [{ id: { in: chunk } }, { userId: { in: chunk } }],
          accountType: { in: ['NORMAL', 'DEMO'] },
        },
        select: {
          id: true,
          userId: true,
          department: { select: { name: true } },
          academicStanding: { select: { currentSemesterSequence: true } },
          programVersion: {
            select: { program: { select: { code: true, name: true } } },
          },
        },
      });
      for (const row of rows) {
        const program = row.programVersion?.program;
        const value = {
          departmentName: row.department?.name ?? null,
          programmeName: program
            ? [program.code, program.name].filter(Boolean).join(' ')
            : null,
          semesterNo: row.academicStanding?.currentSemesterSequence ?? null,
        };
        map.set(row.id, value);
        map.set(row.userId, value);
      }
    }
    return map;
  }

  private async filterLabels(
    tenantId: string,
    query: AttendanceReportQueryDto,
  ) {
    const [tenant, year, program, department, course, section, shift] =
      await Promise.all([
        this.prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { name: true },
        }),
        query.academicYearId
          ? this.prisma.academicYear.findFirst({
              where: { id: query.academicYearId, tenantId },
              select: { name: true },
            })
          : null,
        query.programId
          ? this.prisma.program.findFirst({
              where: { id: query.programId, tenantId },
              select: { code: true, name: true },
            })
          : null,
        query.departmentId
          ? this.prisma.department.findFirst({
              where: { id: query.departmentId, tenantId },
              select: { name: true },
            })
          : null,
        query.courseId
          ? this.prisma.course.findFirst({
              where: { id: query.courseId, tenantId },
              select: { code: true, title: true },
            })
          : null,
        query.offeringSectionId
          ? this.prisma.offeringSection.findFirst({
              where: { id: query.offeringSectionId, tenantId },
              select: { sectionCode: true },
            })
          : null,
        query.shiftId
          ? this.prisma.shift.findFirst({
              where: { id: query.shiftId, tenantId },
              select: { name: true },
            })
          : null,
      ]);
    return {
      institutionName: tenant?.name?.trim() || 'Don Bosco College, Tura',
      academicYear: year?.name ?? null,
      programme: program ? `${program.code} ${program.name}`.trim() : null,
      department: department?.name ?? null,
      subject: course ? `${course.code} ${course.title}`.trim() : null,
      section: section?.sectionCode ? `Section ${section.sectionCode}` : null,
      shift: shift?.name ?? null,
    };
  }

  private present(
    built: Awaited<ReturnType<MonthWiseAttendanceService['build']>>,
    studentIds: string[] | undefined,
    attendanceFilter: string | undefined,
  ): MonthWiseExportModel &
    Awaited<ReturnType<MonthWiseAttendanceService['build']>> {
    const order = new Map((studentIds ?? []).map((id, index) => [id, index]));
    const rows = studentIds
      ? built.rows
          .filter((row) => order.has(row.studentId))
          .sort(
            (left, right) =>
              (order.get(left.studentId) ?? 0) -
              (order.get(right.studentId) ?? 0),
          )
      : built.rows;
    return {
      ...built,
      rows,
      attendanceFilter: attendanceFilter?.trim() || 'All students',
      summary: { ...built.summary, students: rows.length },
    };
  }

  private toCsv(
    report: Awaited<ReturnType<MonthWiseAttendanceService['build']>>,
  ) {
    const columns = report.exportColumns;
    const lines = [
      this.csvEscape(report.institutionName),
      this.csvEscape('Month-wise Cumulative Attendance Report'),
      this.csvEscape(
        [
          report.academicYear,
          report.programme,
          report.semester,
          report.monthRange,
        ]
          .filter(Boolean)
          .join(' · '),
      ),
      this.csvEscape(`Generated ${report.generatedAt}`),
      columns.map((column) => this.csvEscape(column.label)).join(','),
      ...report.rows.map((row) =>
        columns
          .map((column) => this.csvEscape(String(rowValue(row, column.key))))
          .join(','),
      ),
    ];
    return {
      csv: `${lines.join('\n')}\n`,
      filename: `month-wise-attendance-${report.from}-to-${report.to}.csv`,
    };
  }

  private csvEscape(value: string) {
    if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
    return value;
  }
}

function rowValue(
  row: {
    fullName: string;
    rollNumber: string | null;
    overallDisplay: string;
    months: Array<{ key: string; display: string }>;
  },
  key: string,
) {
  if (key === 'fullName') return row.fullName;
  if (key === 'rollNumber') return row.rollNumber ?? '';
  if (key === 'overallDisplay') return row.overallDisplay;
  const month = row.months.find((item) => key === `month_${item.key}`);
  return month?.display ?? '';
}
