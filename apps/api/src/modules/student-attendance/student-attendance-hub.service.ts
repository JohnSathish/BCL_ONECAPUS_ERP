import { Injectable } from '@nestjs/common';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';
import { WorkingDayEngineService } from '../academic-calendar/working-day-engine.service';
import { resolveStudentFullName } from './attendance-display.util';
import { AttendancePolicyService } from './attendance-policy.service';
import type { AttendanceReportQueryDto } from './dto/student-attendance.dto';
import {
  classesStillNeeded,
  classifyAttendanceSession,
  foldEntries,
  percentageFromFold,
  shortageBand,
} from './attendance-report.util';

const CONDUCTED = new Set(['MARKED', 'LOCKED', 'FROZEN']);

@Injectable()
export class StudentAttendanceHubService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendancePolicy: AttendancePolicyService,
    private readonly workingDays: WorkingDayEngineService,
  ) {}

  async scopedQuery(user: JwtUser, query: AttendanceReportQueryDto) {
    const permissions = user.permissions ?? [];
    const collegeWide =
      permissions.includes('student-attendance:reports') ||
      permissions.includes('student-attendance:admin') ||
      user.dataScope?.allDepartments === true;
    if (collegeWide) return query;
    const staff = await this.prisma.staffProfile.findFirst({
      where: { tenantId: user.tid, portalUserId: user.sub, deletedAt: null },
      select: { id: true, departmentId: true },
    });
    const next = { ...query };
    if (staff) next.staffProfileId = staff.id;
    const departments = user.dataScope?.departmentIds ?? [];
    if (!next.departmentId && departments.length === 1) {
      next.departmentId = departments[0];
    }
    if (
      next.departmentId &&
      departments.length &&
      !departments.includes(next.departmentId)
    ) {
      next.departmentId = departments[0];
    }
    return next;
  }

  async build(tenantId: string, type: string, query: AttendanceReportQueryDto) {
    const bundle = await this.load(tenantId, type, query);
    if (type === 'dashboard') return this.dashboard(bundle);
    if (type === 'daily') return this.daily(bundle);
    if (type === 'semester' || type === 'subject')
      return this.subjectRows(bundle, type);
    if (type === 'statement') return this.statement(bundle);
    if (type === 'absentees') return this.absentees(bundle);
    if (type === 'shortage') return this.shortage(bundle);
    if (type === 'register') return this.register(bundle);
    if (type === 'period') return this.period(bundle);
    if (type === 'department') return this.department(bundle);
    if (type === 'faculty-submission') return this.facultySubmission(bundle);
    if (type === 'timetable-gap')
      return this.timetableGap(tenantId, bundle, query);
    if (type === 'audit') return this.audit(tenantId, bundle, query);
    return this.subjectRows(bundle, type);
  }

  private async load(
    tenantId: string,
    type: string,
    query: AttendanceReportQueryDto,
  ) {
    const policy = await this.attendancePolicy.getOrCreate(tenantId);
    const range = this.range(query, type);
    const where: Record<string, unknown> = {
      tenantId,
      deletedAt: null,
      sessionDate: { gte: range.from, lte: range.to },
    };
    if (query.academicYearId) where.academicYearId = query.academicYearId;
    if (query.shiftId) where.shiftId = query.shiftId;
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
    const sessions = await (
      this.prisma as any
    ).studentAttendanceSession.findMany({
      where,
      include: { entries: true },
      orderBy: [{ sessionDate: 'asc' }, { periodNo: 'asc' }],
      take: 8000,
    });
    const studentIds = [
      ...new Set(
        sessions.flatMap((session: any) =>
          (session.entries ?? []).map((entry: any) => entry.studentId),
        ),
      ),
    ] as string[];
    const facultyIds = [
      ...new Set(
        sessions
          .map((session: any) => session.primaryFacultyId || session.markedById)
          .filter(Boolean),
      ),
    ] as string[];
    const courseIds = [
      ...new Set(
        sessions.map((session: any) => session.courseId).filter(Boolean),
      ),
    ] as string[];
    const [students, faculty, courses, tenant, year] = await Promise.all([
      studentIds.length
        ? this.prisma.student.findMany({
            where: { id: { in: studentIds } },
            select: {
              id: true,
              rollNumber: true,
              enrollmentNumber: true,
              masterProfile: {
                select: { fullName: true, mobileNumber: true, email: true },
              },
              user: { select: { displayName: true } },
            },
          })
        : [],
      facultyIds.length
        ? this.prisma.staffProfile.findMany({
            where: { id: { in: facultyIds } },
            select: { id: true, fullName: true },
          })
        : [],
      courseIds.length
        ? this.prisma.course.findMany({
            where: { id: { in: courseIds } },
            select: {
              id: true,
              code: true,
              title: true,
              department: { select: { id: true, name: true } },
            },
          })
        : [],
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
    ]);
    const fromKey = range.from.toISOString().slice(0, 10);
    const toKey = range.to.toISOString().slice(0, 10);
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
    const classified = sessions.map((session: any) => {
      const dateKey = new Date(session.sessionDate).toISOString().slice(0, 10);
      const role = classifyAttendanceSession({
        sessionStatus: session.status,
        blockedCalendarDay: blocked.has(dateKey),
        relocatedOrForced: false,
      });
      return { ...session, dateKey, role };
    });
    return {
      type,
      policy,
      from: fromKey,
      to: toKey,
      institutionName: tenant?.name?.trim() || 'Don Bosco College, Tura',
      academicYear: year?.name ?? null,
      includeContact: Boolean(query.departmentId) || type === 'shortage',
      sessions: classified,
      blockedDates: blocked,
      students: new Map(students.map((row) => [row.id, row])),
      faculty: new Map(faculty.map((row) => [row.id, row.fullName])),
      courses: new Map(courses.map((row) => [row.id, row])),
      query,
    };
  }

  private range(query: AttendanceReportQueryDto, type: string) {
    if (query.from || query.to || query.date) {
      const from = new Date(query.from ?? query.date ?? query.to ?? new Date());
      const to = new Date(query.to ?? query.date ?? query.from ?? new Date());
      return { from, to };
    }
    const now = new Date();
    if (type === 'daily') {
      const day = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );
      return { from: day, to: day };
    }
    const year = query.year ?? now.getFullYear();
    const month = (query.month ?? now.getMonth() + 1) - 1;
    return {
      from: new Date(Date.UTC(year, month, 1)),
      to: new Date(Date.UTC(year, month + 1, 0)),
    };
  }

  private shell(
    bundle: Awaited<ReturnType<StudentAttendanceHubService['load']>>,
    summary: Record<string, number>,
  ) {
    return {
      institutionName: bundle.institutionName,
      academicYear: bundle.academicYear,
      from: bundle.from,
      to: bundle.to,
      generatedAt: new Date().toISOString(),
      attendanceMode: bundle.policy.attendanceMode,
      shortageThresholdPct: bundle.policy.shortageThresholdPct,
      calculation:
        'Percentage = (Present + approved leave + on duty) ÷ classes conducted. Pending submissions are not absences.',
      summary,
    };
  }

  private studentName(bundle: any, studentId: string) {
    const student = bundle.students.get(studentId);
    return {
      studentId,
      rollNumber: student?.rollNumber ?? null,
      enrollmentNumber: student?.enrollmentNumber ?? null,
      fullName: resolveStudentFullName(student),
      mobile: bundle.includeContact
        ? (student?.masterProfile?.mobileNumber ?? null)
        : null,
    };
  }

  private courseLabel(bundle: any, session: any) {
    const course = session.courseId
      ? bundle.courses.get(session.courseId)
      : null;
    return course ? `${course.code} ${course.title}` : 'Subject';
  }

  private daily(bundle: any) {
    const rows: Array<Record<string, unknown>> = [];
    let present = 0;
    let absent = 0;
    const pending = bundle.sessions.filter(
      (session: any) => session.role === 'scheduled',
    );
    for (const session of bundle.sessions.filter(
      (item: any) => item.role === 'conducted',
    )) {
      for (const entry of session.entries ?? []) {
        if (
          bundle.query.studentId &&
          entry.studentId !== bundle.query.studentId
        )
          continue;
        if (entry.status === 'P') present += 1;
        if (entry.status === 'A') absent += 1;
        rows.push({
          ...this.studentName(bundle, entry.studentId),
          subject: this.courseLabel(bundle, session),
          subjectName: this.courseLabel(bundle, session),
          status: entry.status,
          periodNo: session.periodNo,
          facultyName:
            bundle.faculty.get(session.primaryFacultyId) ??
            bundle.faculty.get(session.markedById) ??
            null,
          totalSessions: 1,
          attendedCount: ['P', 'L', 'OD', 'SPORTS', 'NSS', 'NCC'].includes(
            entry.status,
          )
            ? 1
            : 0,
          absentCount: entry.status === 'A' ? 1 : 0,
          percentage: ['P', 'L', 'OD', 'SPORTS', 'NSS', 'NCC'].includes(
            entry.status,
          )
            ? 100
            : 0,
        });
      }
    }
    const enrolled = new Set(rows.map((row) => row.studentId)).size;
    return {
      type: 'daily',
      ...this.shell(bundle, {
        students: enrolled,
        present,
        absent,
        pendingSessions: pending.length,
        conductedClasses: bundle.sessions.filter(
          (session: any) => session.role === 'conducted',
        ).length,
      }),
      rows,
      pendingSessions: pending.map((session: any) => ({
        id: session.id,
        date: session.dateKey,
        periodNo: session.periodNo,
        subject: this.courseLabel(bundle, session),
        facultyName: bundle.faculty.get(session.primaryFacultyId) ?? null,
        status: 'PENDING',
      })),
    };
  }

  private subjectRows(bundle: any, type: string) {
    const groups = new Map<
      string,
      { label: string; entries: any[]; students: Set<string> }
    >();
    for (const session of bundle.sessions.filter(
      (item: any) => item.role === 'conducted',
    )) {
      const key =
        session.courseId ?? session.teachingSubjectGroupId ?? 'subject';
      const group = groups.get(key) ?? {
        label: this.courseLabel(bundle, session),
        entries: [],
        students: new Set<string>(),
      };
      for (const entry of session.entries ?? []) {
        if (
          bundle.query.studentId &&
          entry.studentId !== bundle.query.studentId
        )
          continue;
        group.entries.push({
          sessionId: `${session.id}:${entry.studentId}`,
          status: entry.status,
        });
        group.students.add(entry.studentId);
      }
      groups.set(key, group);
    }
    const rows = [...groups.entries()].map(([key, group]) => {
      const fold = foldEntries(group.entries);
      return {
        studentId: key,
        fullName: group.label,
        rollNumber: '',
        enrollmentNumber: '',
        totalSessions: fold.conducted - fold.exempted,
        attendedCount: fold.countedPresent,
        absentCount: fold.absent,
        leaveCount: fold.leave,
        dutyCount: fold.duty,
        percentage: percentageFromFold(fold),
        students: group.students.size,
      };
    });
    return {
      type,
      ...this.shell(bundle, {
        subjects: rows.length,
        students: rows.reduce((s, r) => s + Number(r.students), 0),
      }),
      rows,
    };
  }

  private statement(bundle: any) {
    const byStudent = new Map<string, any[]>();
    for (const session of bundle.sessions.filter(
      (item: any) => item.role === 'conducted',
    )) {
      for (const entry of session.entries ?? []) {
        if (
          bundle.query.studentId &&
          entry.studentId !== bundle.query.studentId
        )
          continue;
        const list = byStudent.get(entry.studentId) ?? [];
        list.push({ session, entry });
        byStudent.set(entry.studentId, list);
      }
    }
    const rows = [...byStudent.entries()].flatMap(([studentId, marks]) => {
      const bySubject = new Map<string, any[]>();
      for (const mark of marks) {
        const key = mark.session.courseId ?? 'subject';
        const list = bySubject.get(key) ?? [];
        list.push(mark);
        bySubject.set(key, list);
      }
      return [...bySubject.entries()].map(([key, subjectMarks]) => {
        const fold = foldEntries(
          subjectMarks.map((mark) => ({
            sessionId: mark.session.id,
            status: mark.entry.status,
          })),
        );
        return {
          ...this.studentName(bundle, studentId),
          subject: this.courseLabel(bundle, subjectMarks[0].session),
          subjectKey: key,
          totalSessions: fold.conducted - fold.exempted,
          attendedCount: fold.countedPresent,
          absentCount: fold.absent,
          leaveCount: fold.leave,
          dutyCount: fold.duty,
          percentage: percentageFromFold(fold),
          history: subjectMarks
            .map((mark) => `${mark.session.dateKey}:${mark.entry.status}`)
            .join(', '),
        };
      });
    });
    return {
      type: 'statement',
      ...this.shell(bundle, {
        students: new Set(rows.map((row) => row.studentId)).size,
      }),
      rows,
    };
  }

  private absentees(bundle: any) {
    const absentRows: Array<Record<string, unknown>> = [];
    const byStudent = new Map<string, string[]>();
    for (const session of bundle.sessions.filter(
      (item: any) => item.role === 'conducted',
    )) {
      for (const entry of session.entries ?? []) {
        if (entry.status !== 'A') continue;
        if (
          bundle.query.studentId &&
          entry.studentId !== bundle.query.studentId
        )
          continue;
        const dates = byStudent.get(entry.studentId) ?? [];
        dates.push(session.dateKey);
        byStudent.set(entry.studentId, dates);
        absentRows.push({
          ...this.studentName(bundle, entry.studentId),
          date: session.dateKey,
          subject: this.courseLabel(bundle, session),
          periodNo: session.periodNo,
          status: 'A',
          totalSessions: 1,
          absentCount: 1,
          attendedCount: 0,
          percentage: 0,
        });
      }
    }
    const rows = absentRows.map((row) => {
      const dates = [
        ...new Set(byStudent.get(String(row.studentId)) ?? []),
      ].sort();
      let streak = 1;
      let best = 1;
      for (let i = 1; i < dates.length; i += 1) {
        const prev = new Date(dates[i - 1]).getTime();
        const next = new Date(dates[i]).getTime();
        streak = next - prev <= 86_400_000 * 3 ? streak + 1 : 1;
        best = Math.max(best, streak);
      }
      return {
        ...row,
        repeatAbsences: dates.length,
        consecutiveAbsences: dates.length ? best : 0,
      };
    });
    const pendingSessions = bundle.sessions
      .filter((session: any) => session.role === 'scheduled')
      .map((session: any) => ({
        id: session.id,
        date: session.dateKey,
        periodNo: session.periodNo,
        subject: this.courseLabel(bundle, session),
        status: 'PENDING',
      }));
    return {
      type: 'absentees',
      ...this.shell(bundle, {
        absences: rows.length,
        pendingSessions: pendingSessions.length,
      }),
      rows,
      pendingSessions,
    };
  }

  private shortage(bundle: any) {
    const byStudent = new Map<
      string,
      Array<{ sessionId: string; status: string }>
    >();
    for (const session of bundle.sessions.filter(
      (item: any) => item.role === 'conducted',
    )) {
      for (const entry of session.entries ?? []) {
        const list = byStudent.get(entry.studentId) ?? [];
        list.push({ sessionId: session.id, status: entry.status });
        byStudent.set(entry.studentId, list);
      }
    }
    const threshold = Number(bundle.policy.shortageThresholdPct ?? 75);
    const rows = [...byStudent.entries()]
      .map(([studentId, entries]) => {
        const fold = foldEntries(entries);
        const conducted = fold.conducted - fold.exempted;
        const percentage = percentageFromFold(fold);
        return {
          ...this.studentName(bundle, studentId),
          totalSessions: conducted,
          attendedCount: fold.countedPresent,
          absentCount: fold.absent,
          leaveCount: fold.leave,
          dutyCount: fold.duty,
          percentage,
          band: shortageBand(percentage, threshold),
          classesStillNeeded: classesStillNeeded(
            conducted,
            fold.countedPresent,
            threshold,
          ),
        };
      })
      .filter((row) => row.percentage < threshold)
      .sort((a, b) => a.percentage - b.percentage);
    return {
      type: 'shortage',
      ...this.shell(bundle, {
        students: rows.length,
        near: rows.filter((row) => row.band === 'NEAR').length,
        mid: rows.filter((row) => row.band === 'MID').length,
        low: rows.filter((row) => row.band === 'LOW').length,
      }),
      rows,
    };
  }

  private register(bundle: any) {
    const columns = [
      ...new Set(
        bundle.sessions
          .filter((session: any) => session.role === 'conducted')
          .map((session: any) => session.dateKey),
      ),
    ].sort();
    const grid = new Map<string, Record<string, string>>();
    for (const session of bundle.sessions.filter(
      (item: any) => item.role === 'conducted',
    )) {
      for (const entry of session.entries ?? []) {
        const row = grid.get(entry.studentId) ?? {};
        row[session.dateKey] = row[session.dateKey]
          ? `${row[session.dateKey]}/${entry.status}`
          : entry.status;
        grid.set(entry.studentId, row);
      }
    }
    const rows = [...grid.entries()].map(([studentId, marks]) => ({
      ...this.studentName(bundle, studentId),
      ...Object.fromEntries(columns.map((date) => [date, marks[date] ?? ''])),
      totalSessions: columns.filter((date) => marks[date]).length,
      attendedCount: Object.values(marks).filter((status) =>
        ['P', 'L', 'OD', 'SPORTS', 'NSS', 'NCC'].includes(status),
      ).length,
      absentCount: Object.values(marks).filter((status) => status === 'A')
        .length,
      percentage: 0,
    }));
    return {
      type: 'register',
      ...this.shell(bundle, { students: rows.length, dates: columns.length }),
      dateColumns: columns,
      rows,
    };
  }

  private period(bundle: any) {
    const rows = bundle.sessions
      .filter(
        (session: any) =>
          session.role === 'conducted' || session.role === 'scheduled',
      )
      .map((session: any) => {
        const entries = session.entries ?? [];
        const present = entries.filter((entry: any) =>
          ['P', 'L', 'OD', 'SPORTS', 'NSS', 'NCC'].includes(entry.status),
        ).length;
        const absent = entries.filter(
          (entry: any) => entry.status === 'A',
        ).length;
        return {
          fullName: this.courseLabel(bundle, session),
          rollNumber: session.dateKey,
          date: session.dateKey,
          periodNo: session.periodNo,
          semesterNo: session.semesterNo,
          shiftId: session.shiftId,
          facultyName: bundle.faculty.get(session.primaryFacultyId) ?? null,
          status: session.role === 'conducted' ? 'SUBMITTED' : 'PENDING',
          totalSessions: entries.length,
          attendedCount: present,
          absentCount: absent,
          percentage: entries.length
            ? Math.round((present / entries.length) * 10000) / 100
            : 0,
        };
      });
    return {
      type: 'period',
      ...this.shell(bundle, {
        periods: rows.length,
        pending: rows.filter((row: any) => row.status === 'PENDING').length,
      }),
      rows,
    };
  }

  private department(bundle: any) {
    const groups = new Map<string, any[]>();
    for (const session of bundle.sessions.filter(
      (item: any) => item.role === 'conducted',
    )) {
      const course = session.courseId
        ? bundle.courses.get(session.courseId)
        : null;
      const key = course?.department?.name ?? 'Unassigned';
      const list = groups.get(key) ?? [];
      for (const entry of session.entries ?? []) {
        list.push({
          sessionId: `${session.id}:${entry.studentId}`,
          status: entry.status,
          studentId: entry.studentId,
        });
      }
      groups.set(key, list);
    }
    const rows = [...groups.entries()].map(([label, entries]) => {
      const fold = foldEntries(entries);
      const threshold = Number(bundle.policy.shortageThresholdPct ?? 75);
      const percentage = percentageFromFold(fold);
      return {
        fullName: label,
        rollNumber: '',
        totalSessions: fold.conducted - fold.exempted,
        attendedCount: fold.countedPresent,
        absentCount: fold.absent,
        percentage,
        students: new Set(entries.map((entry) => entry.studentId)).size,
        shortage: percentage < threshold ? 1 : 0,
      };
    });
    return {
      type: 'department',
      ...this.shell(bundle, { departments: rows.length }),
      rows,
    };
  }

  private facultySubmission(bundle: any) {
    const groups = new Map<
      string,
      { name: string; scheduled: number; submitted: number }
    >();
    for (const session of bundle.sessions) {
      if (session.role === 'cancelled' || session.role === 'excluded') continue;
      const id = session.primaryFacultyId ?? 'unassigned';
      const group = groups.get(id) ?? {
        name: bundle.faculty.get(id) ?? 'Unassigned faculty',
        scheduled: 0,
        submitted: 0,
      };
      group.scheduled += 1;
      if (CONDUCTED.has(String(session.status))) group.submitted += 1;
      groups.set(id, group);
    }
    const rows = [...groups.values()].map((group) => ({
      fullName: group.name,
      rollNumber: '',
      totalSessions: group.scheduled,
      attendedCount: group.submitted,
      absentCount: group.scheduled - group.submitted,
      percentage: group.scheduled
        ? Math.round((group.submitted / group.scheduled) * 10000) / 100
        : 0,
    }));
    return {
      type: 'faculty-submission',
      ...this.shell(bundle, { faculty: rows.length }),
      rows,
    };
  }

  private async timetableGap(
    tenantId: string,
    bundle: any,
    query: AttendanceReportQueryDto,
  ) {
    const plans = await this.prisma.timetablePlan.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: 'PUBLISHED',
        ...(query.shiftId ? { shiftId: query.shiftId } : {}),
        ...(query.semesterNo ? { semesterSequence: query.semesterNo } : {}),
      },
      select: { id: true },
      take: 20,
    });
    const entries = plans.length
      ? await this.prisma.timetablePlanEntry.findMany({
          where: {
            tenantId,
            deletedAt: null,
            planId: { in: plans.map((plan) => plan.id) },
            status: { not: 'CANCELLED' },
          },
          select: {
            id: true,
            dayOfWeek: true,
            periodNo: true,
            staffProfileId: true,
            courseId: true,
          },
          take: 2000,
        })
      : [];
    const sessionByEntryDate = new Set(
      bundle.sessions
        .filter((session: any) => session.timetablePlanEntryId)
        .map(
          (session: any) =>
            `${session.timetablePlanEntryId}|${session.dateKey}`,
        ),
    );
    const duplicateKeys = new Map<string, number>();
    for (const session of bundle.sessions) {
      if (!session.timetablePlanEntryId) continue;
      const key = `${session.timetablePlanEntryId}|${session.dateKey}`;
      duplicateKeys.set(key, (duplicateKeys.get(key) ?? 0) + 1);
    }
    const rows: Array<Record<string, unknown>> = [];
    const cursor = new Date(bundle.from);
    const end = new Date(bundle.to);
    let guard = 0;
    while (cursor <= end && guard < 45) {
      const dateKey = cursor.toISOString().slice(0, 10);
      const weekday = cursor.getUTCDay() === 0 ? 7 : cursor.getUTCDay();
      for (const entry of entries.filter(
        (item) => item.dayOfWeek === weekday,
      )) {
        const key = `${entry.id}|${dateKey}`;
        const session = bundle.sessions.find(
          (item: any) =>
            item.timetablePlanEntryId === entry.id && item.dateKey === dateKey,
        );
        if (session?.role === 'conducted' && (duplicateKeys.get(key) ?? 0) < 2)
          continue;
        const holiday = bundle.blockedDates?.has(dateKey) === true;
        const kind =
          (duplicateKeys.get(key) ?? 0) > 1
            ? 'DUPLICATE'
            : session?.role === 'cancelled'
              ? 'CANCELLED'
              : holiday
                ? 'HOLIDAY'
                : sessionByEntryDate.has(key)
                  ? 'PENDING'
                  : 'MISSING';
        rows.push({
          fullName:
            bundle.courses.get(entry.courseId)?.code ?? 'Scheduled class',
          rollNumber: dateKey,
          date: dateKey,
          periodNo: entry.periodNo,
          status: kind,
          facultyName: bundle.faculty.get(entry.staffProfileId) ?? null,
          totalSessions: 1,
          attendedCount: 0,
          absentCount: 0,
          percentage: 0,
        });
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      guard += 1;
    }
    return {
      type: 'timetable-gap',
      ...this.shell(bundle, {
        missing: rows.filter((row) => row.status === 'MISSING').length,
        holiday: rows.filter((row) => row.status === 'HOLIDAY').length,
        cancelled: rows.filter((row) => row.status === 'CANCELLED').length,
        duplicates: rows.filter((row) => row.status === 'DUPLICATE').length,
      }),
      rows,
    };
  }

  private async audit(
    tenantId: string,
    bundle: any,
    query: AttendanceReportQueryDto,
  ) {
    const logs = await (this.prisma as any).studentAttendanceAuditLog.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: new Date(bundle.from),
          lte: new Date(`${bundle.to}T23:59:59.999Z`),
        },
        ...(query.studentId ? { studentId: query.studentId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });
    const rows = logs.map((log: any) => ({
      fullName: log.action,
      rollNumber: log.studentId ?? '',
      studentId: log.studentId,
      status: log.action,
      before: JSON.stringify(log.before ?? {}),
      after: JSON.stringify(log.after ?? {}),
      actorId: log.actorId,
      createdAt: log.createdAt,
      totalSessions: 0,
      attendedCount: 0,
      absentCount: 0,
      percentage: 0,
    }));
    return {
      type: 'audit',
      ...this.shell(bundle, { events: rows.length }),
      rows,
    };
  }

  private dashboard(bundle: any) {
    const conducted = bundle.sessions.filter(
      (session: any) => session.role === 'conducted',
    );
    const entries = conducted.flatMap((session: any) => session.entries ?? []);
    const fold = foldEntries(
      entries.map((entry: any, index: number) => ({
        sessionId: `${entry.sessionId ?? index}:${entry.studentId}`,
        status: entry.status,
      })),
    );
    const pending = bundle.sessions.filter(
      (session: any) => session.role === 'scheduled',
    ).length;
    return {
      type: 'dashboard',
      ...this.shell(bundle, {
        students: new Set(entries.map((entry: any) => entry.studentId)).size,
        conductedClasses: conducted.length,
        pendingSessions: pending,
        averagePercentage: percentageFromFold(fold),
      }),
      rows: [],
    };
  }
}
