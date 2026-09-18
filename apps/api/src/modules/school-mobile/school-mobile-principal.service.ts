import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';
import { SchoolSisAttendanceService } from '../school-sis/school-sis-attendance.service';
import { SchoolSisExamsService } from '../school-sis/school-sis-exams.service';
import { SchoolSisMonthlyFeesService } from '../school-sis/school-sis-monthly-fees.service';
import { SchoolSisService } from '../school-sis/school-sis.service';
import { SchoolWebService } from '../school-web/school-web.service';
import { SchoolMobileAccessService } from './school-mobile-access.service';
import { SchoolMobileInboxService } from './school-mobile-inbox.service';

@Injectable()
export class SchoolMobilePrincipalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sis: SchoolSisService,
    private readonly access: SchoolMobileAccessService,
    private readonly attendance: SchoolSisAttendanceService,
    private readonly monthlyFees: SchoolSisMonthlyFeesService,
    private readonly exams: SchoolSisExamsService,
    private readonly web: SchoolWebService,
    private readonly inbox: SchoolMobileInboxService,
  ) {}

  async desk(user: JwtUser) {
    this.access.assertOffice(user);
    const year = await this.sis.currentYear(user.tid).catch(() => null);
    const [students, teachers, classes, att, fees, exams, broadcasts, bundle] =
      await Promise.all([
        this.prisma.schoolStudent.count({
          where: { tenantId: user.tid, deletedAt: null, status: 'ACTIVE' },
        }),
        this.prisma.schoolStaff.count({
          where: {
            tenantId: user.tid,
            deletedAt: null,
            status: 'ACTIVE',
            staffType: 'TEACHING',
          },
        }),
        this.prisma.schoolSection.count({
          where: { tenantId: user.tid, deletedAt: null, active: true },
        }),
        this.attendance.dashboard(user.tid, {}).catch(() => null),
        this.monthlyFees.dashboard(user.tid).catch(() => null),
        this.exams.dashboard(user.tid).catch(() => null),
        this.inbox.listBroadcasts(user.tid).catch(() => []),
        this.web.getPublicBundle(user.tid).catch(() => null),
      ]);
    const totals = (att as { totals?: Record<string, number> } | null)?.totals;
    const completion = (
      att as { completion?: { submitted?: number; total?: number } } | null
    )?.completion;
    return {
      year: year ? { id: year.id, name: year.name } : null,
      kpis: {
        students,
        teachers,
        classes,
        attendanceToday: totals?.percent ?? null,
        present: totals?.present ?? 0,
        absent: totals?.absent ?? 0,
        late: totals?.late ?? 0,
        classesMarked: completion?.submitted ?? 0,
        classesTotal: completion?.total ?? classes,
        feeCollectedMonth: fees?.monthCollection ?? 0,
        feePending: fees?.pendingFees ?? 0,
        feePendingStudents: fees?.monthPending ?? 0,
        examsUpcoming: exams?.upcoming ?? 0,
        examsOngoing: exams?.ongoing ?? 0,
        marksPending: exams?.marksPending ?? 0,
      },
      attendanceByClass: (
        (att as { byClass?: Array<Record<string, unknown>> } | null)?.byClass ??
        []
      ).slice(0, 8),
      feeByClass: (fees?.byClass ?? []).slice(0, 8),
      upcomingExams: ((exams?.upcomingList ?? []) as Array<{ id: string }>)
        .slice(0, 5)
        .map((e) => this.examCard(e)),
      broadcasts: (broadcasts ?? []).slice(0, 6),
      notices: (bundle?.notices ?? []).slice(0, 6),
    };
  }

  async students(user: JwtUser, q?: string, gradeId?: string) {
    this.access.assertOffice(user);
    const year = await this.sis.currentYear(user.tid);
    const term = q?.trim();
    const enrollments = await this.prisma.schoolEnrollment.findMany({
      where: {
        tenantId: user.tid,
        academicYearId: year.id,
        status: 'ACTIVE',
        deletedAt: null,
        ...(gradeId ? { section: { gradeId } } : {}),
        ...(term
          ? {
              student: {
                OR: [
                  {
                    fullName: {
                      contains: term,
                      mode: 'insensitive' as Prisma.QueryMode,
                    },
                  },
                  {
                    admissionNumber: {
                      contains: term,
                      mode: 'insensitive' as Prisma.QueryMode,
                    },
                  },
                ],
              },
            }
          : {}),
      },
      include: {
        student: true,
        section: { include: { grade: true } },
      },
      orderBy: [{ rollNumber: 'asc' }],
      take: 120,
    });
    const grades = await this.prisma.schoolGrade.findMany({
      where: { tenantId: user.tid, deletedAt: null, active: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true },
    });
    return {
      grades,
      items: enrollments.map((row) => ({
        id: row.student.id,
        fullName: row.student.fullName,
        admissionNumber: row.student.admissionNumber,
        photoUrl: row.student.photoUrl,
        gender: row.student.gender,
        phone: row.student.phone,
        status: row.student.status,
        rollNumber: row.rollNumber,
        classLabel: `${row.section.grade.name} ${row.section.name}`.trim(),
        gradeId: row.section.gradeId,
      })),
    };
  }

  async teachers(user: JwtUser, q?: string) {
    this.access.assertOffice(user);
    const term = q?.trim();
    const rows = await this.prisma.schoolStaff.findMany({
      where: {
        tenantId: user.tid,
        deletedAt: null,
        status: 'ACTIVE',
        staffType: 'TEACHING',
        ...(term
          ? {
              OR: [
                {
                  fullName: {
                    contains: term,
                    mode: 'insensitive' as Prisma.QueryMode,
                  },
                },
                {
                  designation: {
                    contains: term,
                    mode: 'insensitive' as Prisma.QueryMode,
                  },
                },
                {
                  employeeCode: {
                    contains: term,
                    mode: 'insensitive' as Prisma.QueryMode,
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: { fullName: 'asc' },
      take: 120,
      select: {
        id: true,
        fullName: true,
        employeeCode: true,
        designation: true,
        department: true,
        phone: true,
        email: true,
        photoUrl: true,
        classAssigned: true,
        teachingExperience: true,
        academicQualification: true,
      },
    });
    return { items: rows, total: rows.length };
  }

  async academics(user: JwtUser) {
    this.access.assertOffice(user);
    const year = await this.sis.currentYear(user.tid);
    const sections = await this.prisma.schoolSection.findMany({
      where: {
        tenantId: user.tid,
        academicYearId: year.id,
        deletedAt: null,
        active: true,
      },
      include: {
        grade: true,
        enrollments: {
          where: { status: 'ACTIVE', deletedAt: null },
          select: { id: true },
        },
        classTeachers: {
          where: { deletedAt: null },
          include: { staff: { select: { fullName: true } } },
          take: 1,
        },
      },
      orderBy: [{ grade: { sortOrder: 'asc' } }, { name: 'asc' }],
    });
    const subjects = await this.prisma.schoolSubject.count({
      where: { tenantId: user.tid, deletedAt: null },
    });
    return {
      year: { id: year.id, name: year.name },
      subjects,
      classes: sections.map((s) => ({
        id: s.id,
        label: `${s.grade.name} ${s.name}`.trim(),
        grade: s.grade.name,
        students: s.enrollments.length,
        classTeacher: s.classTeachers[0]?.staff.fullName ?? null,
      })),
    };
  }

  async examinations(user: JwtUser) {
    this.access.assertOffice(user);
    const dash = await this.exams.dashboard(user.tid);
    const exams = ((dash.exams ?? []) as Array<Record<string, unknown>>).map(
      (e) => this.examCard(e),
    );
    return {
      upcoming: dash.upcoming,
      ongoing: dash.ongoing,
      completed: dash.completed,
      marksPending: dash.marksPending,
      resultsPublished: dash.resultsPublished,
      studentsAppeared: dash.studentsAppeared,
      studentsPassed: dash.studentsPassed,
      studentsFailed: dash.studentsFailed,
      exams,
    };
  }

  async attendanceOverview(user: JwtUser) {
    this.access.assertOffice(user);
    const dash = await this.attendance.dashboard(user.tid, {});
    return {
      date: dash.date,
      dayKind: dash.dayKind,
      totals: dash.totals,
      completion: dash.completion,
      byClass: dash.byClass,
      trend: dash.trend,
    };
  }

  async feesOverview(user: JwtUser) {
    this.access.assertOffice(user);
    return this.monthlyFees.dashboard(user.tid);
  }

  async notices(user: JwtUser) {
    this.access.assertOffice(user);
    const [bundle, broadcasts] = await Promise.all([
      this.web.getPublicBundle(user.tid),
      this.inbox.listBroadcasts(user.tid),
    ]);
    return {
      notices: (bundle.notices ?? []).slice(0, 40),
      broadcasts,
    };
  }

  private examCard(e: Record<string, unknown>) {
    const type = e.type as { name?: string } | undefined;
    return {
      id: e.id,
      name: e.name,
      status: e.status,
      startDate: e.startDate,
      endDate: e.endDate,
      type: type?.name ?? null,
    };
  }
}
