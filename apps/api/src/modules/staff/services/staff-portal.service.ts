import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AcademicLifecycleService } from '../../academic-lifecycle/academic-lifecycle.service';
import { UserNotificationsService } from '../../communication/services/user-notifications.service';
import { LmsDashboardService } from '../../lms/services/lms-dashboard.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { getZonedHour } from '../../../common/utils/time-greeting';

const PRESENT_ATTENDANCE_STATUSES = new Set([
  'PRESENT',
  'LATE',
  'EARLY_EXIT',
  'OVERTIME',
  'HALF_DAY',
]);

function formatTime(value: Date): string {
  const h = value.getUTCHours();
  const m = value.getUTCMinutes();
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${String(hour12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
}

function formatLocalTime(value: Date | null | undefined): string | null {
  if (!value) return null;
  return new Date(value).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function startOfDay(value: Date) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

const TEACHING_TYPES = new Set(['TEACHING', 'GUEST', 'VISITING', 'CONTRACT']);

@Injectable()
export class StaffPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: AcademicLifecycleService,
    private readonly notifications: UserNotificationsService,
    private readonly lms: LmsDashboardService,
  ) {}

  async resolveStaffProfile(tenantId: string, userId: string) {
    const staff = await this.prisma.staffProfile.findFirst({
      where: { tenantId, portalUserId: userId, deletedAt: null },
      include: {
        department: { select: { id: true, code: true, name: true } },
        designation: { select: { id: true, code: true, label: true } },
        campus: {
          select: {
            id: true,
            name: true,
            institutionId: true,
            institution: { select: { id: true, name: true } },
          },
        },
        additionalRoles: { where: { active: true } },
        headedDepartments: { select: { id: true, name: true } },
        portalUser: {
          select: { id: true, lastLoginAt: true, isActive: true },
        },
      },
    });
    if (!staff) {
      throw new NotFoundException(
        'No staff profile is linked to this portal account. Contact HR to link your account.',
      );
    }
    return staff;
  }

  async getMe(user: JwtUser) {
    const staff = await this.resolveStaffProfile(user.tid, user.sub);
    const isTeaching = TEACHING_TYPES.has(staff.staffType);
    const isHod =
      staff.headedDepartments.length > 0 ||
      staff.additionalRoles.some(
        (r) =>
          r.roleCode === 'HOD' ||
          r.roleName.toLowerCase().includes('head of department'),
      );

    return {
      id: staff.id,
      employeeCode: staff.employeeCode,
      fullName: staff.fullName,
      photoUrl: staff.photoUrl,
      email: staff.email,
      mobile: staff.mobile,
      staffType: staff.staffType,
      employmentType: staff.employmentType,
      status: staff.status,
      designation: staff.designation?.label ?? null,
      department: staff.department?.name ?? null,
      departmentId: staff.departmentId,
      institutionName:
        staff.campus?.institution?.name ?? staff.campus?.name ?? null,
      campusName: staff.campus?.name ?? null,
      joiningDate: staff.joiningDate,
      qualification: staff.qualification,
      specialization: staff.specialization,
      experienceYears: staff.experienceYears,
      biometricId: staff.biometricId,
      rfidNo: staff.rfidNo,
      biometricSyncStatus: staff.biometricSyncStatus,
      biometricDeviceId: staff.biometricDeviceId,
      isTeaching,
      isHod,
      isAdminStaff: staff.staffType === 'ADMIN',
      additionalRoles: staff.additionalRoles.map((r) => ({
        code: r.roleCode,
        label: r.roleName,
      })),
      greeting: greetingForHour(getZonedHour(new Date())),
      online: staff.portalUser?.isActive ?? false,
    };
  }

  async getDashboard(user: JwtUser) {
    const staff = await this.resolveStaffProfile(user.tid, user.sub);
    const profile = await this.getMe(user);
    const institutionId =
      staff.campus?.institutionId ??
      (
        await this.prisma.institution.findFirst({
          where: { tenantId: user.tid, deletedAt: null },
          select: { id: true },
        })
      )?.id;

    let academicContext = {
      session: null as string | null,
      cycle: 'ODD' as string,
      activeSemesters: [] as number[],
    };

    if (institutionId) {
      try {
        const dash = await this.lifecycle.getCycleDashboard(
          user.tid,
          institutionId,
        );
        academicContext = {
          session: dash.primarySession?.name ?? null,
          cycle: dash.currentCycle ?? 'ODD',
          activeSemesters: dash.activeSemesters ?? [],
        };
      } catch {
        // lifecycle may be unconfigured
      }
    }

    const assignments = await this.prisma.staffSubjectAssignment.findMany({
      where: { tenantId: user.tid, staffProfileId: staff.id },
      include: {
        course: { select: { id: true, code: true, title: true } },
        offeringSection: {
          select: {
            id: true,
            sectionCode: true,
            seatLedger: { select: { confirmedCount: true } },
          },
        },
      },
      orderBy: [{ semesterNo: 'asc' }, { createdAt: 'desc' }],
    });

    const sectionIds = assignments
      .map((a) => a.offeringSectionId)
      .filter(Boolean) as string[];
    const uniqueSections = new Set(sectionIds);

    const weeklyClasses = assignments.reduce(
      (sum, a) => sum + Number(a.workloadHours ?? 0),
      0,
    );
    const credits = assignments.length * 3;
    const teachingTeamRows = sectionIds.length
      ? await (this.prisma as any).subjectTeachingAssignment.findMany({
          where: {
            tenantId: user.tid,
            offeringSectionId: { in: sectionIds },
            deletedAt: null,
          },
          include: {
            staffProfile: {
              select: {
                id: true,
                fullName: true,
                shortCode: true,
                employeeCode: true,
              },
            },
          },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        })
      : [];
    const teamBySection = new Map<string, any[]>();
    for (const row of teachingTeamRows) {
      const list = teamBySection.get(row.offeringSectionId) ?? [];
      list.push(row);
      teamBySection.set(row.offeringSectionId, list);
    }

    const subjects = assignments.map((a) => ({
      ...(teamBySection
        .get(a.offeringSectionId ?? '')
        ?.find((row) => row.staffProfileId === staff.id) ?? {}),
      id: a.id,
      courseCode: a.course?.code ?? '—',
      courseTitle: a.course?.title ?? 'Subject',
      semesterNo: a.semesterNo,
      sectionCode: a.offeringSection?.sectionCode ?? '—',
      studentCount: a.offeringSection?.seatLedger?.confirmedCount ?? 0,
      offeringSectionId: a.offeringSectionId,
      role:
        teamBySection
          .get(a.offeringSectionId ?? '')
          ?.find((row) => row.staffProfileId === staff.id)?.role ??
        (a.isPrimaryFaculty ? 'PRIMARY_FACULTY' : 'CO_FACULTY'),
      allocationPercent:
        teamBySection
          .get(a.offeringSectionId ?? '')
          ?.find((row) => row.staffProfileId === staff.id)?.allocationPercent ??
        null,
      weeklyHours:
        teamBySection
          .get(a.offeringSectionId ?? '')
          ?.find((row) => row.staffProfileId === staff.id)?.weeklyHours ??
        Number(a.workloadHours ?? 0),
      canMarkAttendance:
        teamBySection
          .get(a.offeringSectionId ?? '')
          ?.find((row) => row.staffProfileId === staff.id)?.canMarkAttendance ??
        true,
      canEnterInternalMarks:
        teamBySection
          .get(a.offeringSectionId ?? '')
          ?.find((row) => row.staffProfileId === staff.id)
          ?.canEnterInternalMarks ?? Boolean(a.isPrimaryFaculty),
      canUploadLessonPlan:
        teamBySection
          .get(a.offeringSectionId ?? '')
          ?.find((row) => row.staffProfileId === staff.id)
          ?.canUploadLessonPlan ?? true,
      canAccessSubjectWorkspace:
        teamBySection
          .get(a.offeringSectionId ?? '')
          ?.find((row) => row.staffProfileId === staff.id)
          ?.canAccessSubjectWorkspace ?? true,
      teachingTeam: (teamBySection.get(a.offeringSectionId ?? '') ?? []).map(
        (row) => ({
          staffProfileId: row.staffProfileId,
          staffName: row.staffProfile?.fullName,
          shortCode:
            row.staffProfile?.shortCode ?? row.staffProfile?.employeeCode,
          role: row.role,
        }),
      ),
    }));

    const todaySchedule = await this.getTodaySchedule(user.tid, staff.id);

    const basicPay = staff.basicPay ? Number(staff.basicPay) : null;
    const today = startOfDay(new Date());
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const calendarEnd = new Date(today.getFullYear(), today.getMonth() + 3, 0);

    const [
      notificationRows,
      unreadCount,
      attendanceRecords,
      todayAttendance,
      attendancePending,
      lmsDashboard,
      pendingLessonPlans,
      examDutyAssigned,
      calendarHolidays,
      governanceMemberships,
      governancePendingAtr,
      governancePendingTasks,
      governanceUpcomingMeetings,
    ] = await Promise.all([
      this.notifications.list(user, 8),
      this.notifications.unreadCount(user),
      this.prisma.staffAttendanceDailyRecord.findMany({
        where: {
          tenantId: user.tid,
          staffProfileId: staff.id,
          attendanceDate: { gte: monthStart, lte: today },
        },
      }),
      this.prisma.staffAttendanceDailyRecord.findFirst({
        where: {
          tenantId: user.tid,
          staffProfileId: staff.id,
          attendanceDate: today,
        },
      }),
      profile.isTeaching
        ? (this.prisma as any).studentAttendanceSession.count({
            where: {
              tenantId: user.tid,
              sessionDate: today,
              deletedAt: null,
              status: 'OPEN',
              primaryFacultyId: staff.id,
            },
          })
        : Promise.resolve(0),
      profile.isTeaching
        ? this.lms.facultyDashboard(user).catch(() => null)
        : Promise.resolve(null),
      profile.isTeaching
        ? this.countPendingLessonPlans(user.tid, staff.id)
        : Promise.resolve(0),
      profile.isTeaching
        ? this.prisma.examInvigilatorAssignment.count({
            where: {
              tenantId: user.tid,
              staffProfileId: staff.id,
              deletedAt: null,
              status: { in: ['ASSIGNED', 'CONFIRMED'] },
            },
          })
        : Promise.resolve(0),
      this.prisma.staffPublicHoliday.findMany({
        where: {
          tenantId: user.tid,
          active: true,
          holidayDate: { gte: monthStart, lte: calendarEnd },
        },
        select: { id: true, name: true, holidayDate: true, holidayType: true },
      }),
      (this.prisma as any).governanceCommitteeMember
        .count({
          where: { tenantId: user.tid, userId: user.sub, status: 'ACTIVE' },
        })
        .catch(() => 0),
      (this.prisma as any).governanceActionItem
        .count({
          where: {
            tenantId: user.tid,
            assignedToId: staff.id,
            status: { in: ['PENDING', 'IN_PROGRESS'] },
          },
        })
        .catch(() => 0),
      (this.prisma as any).governanceTask
        .count({
          where: {
            tenantId: user.tid,
            assignedToId: staff.id,
            status: { in: ['PENDING', 'IN_PROGRESS'] },
          },
        })
        .catch(() => 0),
      (this.prisma as any).governanceMeeting
        .count({
          where: {
            tenantId: user.tid,
            meetingDate: {
              gte: today,
              lte: new Date(today.getTime() + 7 * 86400000),
            },
            status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
            committee: {
              members: { some: { userId: user.sub, status: 'ACTIVE' } },
            },
          },
        })
        .catch(() => 0),
    ]);

    let presentDays = 0;
    let late = 0;
    let absent = 0;
    for (const row of attendanceRecords) {
      if (PRESENT_ATTENDANCE_STATUSES.has(row.status)) presentDays += 1;
      if (row.status === 'ABSENT') absent += 1;
      if ((row.lateMinutes ?? 0) > 0 || row.status === 'LATE') late += 1;
    }
    const tracked = presentDays + absent;
    const attendanceKpi = {
      presentDays,
      late,
      absent,
      percentage: tracked > 0 ? Math.round((presentDays / tracked) * 100) : 0,
      todayCheckIn: formatLocalTime(todayAttendance?.firstInAt) ?? '—',
      todayCheckOut: formatLocalTime(todayAttendance?.lastOutAt),
      device: staff.biometricDeviceId ?? '—',
      status: todayAttendance?.status ?? 'Not recorded',
    };

    // Leave balances from HR module
    const leaveKpi = await this.getLeaveKpi(user.tid, staff.id);

    // integration: payroll — latest published payslip
    const latestPayslip = await this.prisma.payslip.findFirst({
      where: {
        tenantId: user.tid,
        staffProfileId: staff.id,
        status: 'PUBLISHED',
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
    const salaryKpi = {
      currentMonthSalary: latestPayslip
        ? Number(latestPayslip.netSalary)
        : basicPay
          ? Number(basicPay)
          : 0,
      payslipAvailable: latestPayslip != null,
      lastPaymentDate: latestPayslip
        ? `${latestPayslip.year}-${String(latestPayslip.month).padStart(2, '0')}-01`
        : null,
      currency: 'INR',
    };

    const lmsPendingEvaluations = Number(
      lmsDashboard?.cards?.pendingEvaluations ??
        lmsDashboard?.cards?.assignmentsDue ??
        0,
    );

    const tasksKpi = {
      pendingLessonPlans,
      attendancePending,
      examDutyAssigned,
      approvalRequests: 0,
      lmsPendingEvaluations,
      governanceCommittees: governanceMemberships,
      governancePendingAtr,
      governancePendingTasks,
      governanceUpcomingMeetings,
    };

    const calendarEvents = calendarHolidays.map((h) => ({
      id: `holiday-${h.id}`,
      date: h.holidayDate.toISOString().slice(0, 10),
      type: 'holiday' as const,
      title: h.name,
      subtitle: h.holidayType,
    }));

    const notifications = notificationRows.map((n) => ({
      id: n.id,
      type: n.type ?? 'general',
      title: n.title,
      body: n.body ?? '',
      createdAt: n.createdAt?.toISOString?.() ?? String(n.createdAt),
      read: Boolean(n.readAt),
      link: n.link ?? null,
    }));

    const studentsTaught = subjects.reduce((sum, s) => sum + s.studentCount, 0);
    const weeklyWorkloadTarget = Math.max(weeklyClasses, credits || 18);
    const todayClassCount = todaySchedule.length;
    const attendanceSubmittedPercent =
      todayClassCount > 0
        ? Math.round(
            ((todayClassCount - attendancePending) / todayClassCount) * 100,
          )
        : 100;

    const discussionRepliesPending = profile.isTeaching
      ? await this.countPendingDiscussionReplies(user.tid, user.sub, staff.id)
      : 0;

    const departmentNotices = this.buildDepartmentNotices(
      notifications,
      examDutyAssigned,
    );

    const lmsTasks = {
      assignmentsToEvaluate: lmsPendingEvaluations,
      notesPendingUpload: pendingLessonPlans,
      discussionReplies: discussionRepliesPending,
    };

    const performanceSnapshot = {
      classesThisWeek:
        todayClassCount > 0
          ? todayClassCount * 5
          : Math.max(weeklyClasses, assignments.length),
      attendanceSubmittedPercent,
      assignedSubjects: assignments.length,
      studentsTaught,
    };

    return {
      profile,
      academicContext,
      kpis: {
        attendance: attendanceKpi,
        teachingLoad: {
          assignedSubjects: assignments.length,
          sections: uniqueSections.size,
          weeklyClasses: weeklyClasses,
          weeklyWorkloadTarget,
          weeklyWorkloadPercent:
            weeklyWorkloadTarget > 0
              ? Math.min(
                  100,
                  Math.round((weeklyClasses / weeklyWorkloadTarget) * 100),
                )
              : 0,
          credits: credits || 18,
        },
        leave: leaveKpi,
        salary: salaryKpi,
        tasks: tasksKpi,
      },
      lmsTasks,
      departmentNotices,
      performanceSnapshot,
      todaySchedule,
      subjects,
      notifications,
      unreadNotificationCount:
        unreadCount.count ?? notifications.filter((n) => !n.read).length,
      calendarEvents,
      governance: {
        committeeCount: governanceMemberships,
        pendingAtr: governancePendingAtr,
        pendingTasks: governancePendingTasks,
        upcomingMeetings: governanceUpcomingMeetings,
        href: '/staff/governance',
      },
    };
  }

  private buildDepartmentNotices(
    notifications: {
      id: string;
      type: string;
      title: string;
      body: string;
      link: string | null;
    }[],
    examDutyAssigned: number,
  ) {
    const keywords = [
      'department',
      'announcement',
      'exam',
      'hod',
      'meeting',
      'naac',
      'principal',
    ];
    const filtered = notifications.filter((n) =>
      keywords.some(
        (k) =>
          n.type.toLowerCase().includes(k) ||
          n.title.toLowerCase().includes(k) ||
          n.body.toLowerCase().includes(k),
      ),
    );

    const notices = (filtered.length ? filtered : notifications)
      .slice(0, 4)
      .map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        link: n.link,
      }));

    if (
      examDutyAssigned > 0 &&
      !notices.some((n) => n.title.toLowerCase().includes('exam'))
    ) {
      notices.push({
        id: 'exam-duty-allocation',
        title: 'Exam Duty Allocation',
        body: `${examDutyAssigned} invigilation assignment(s) require your attention.`,
        link: '/staff/academic/exams',
      });
    }

    return notices.slice(0, 5);
  }

  private async countPendingDiscussionReplies(
    tenantId: string,
    userId: string,
    staffProfileId: string,
  ) {
    const assignments = await this.prisma.subjectTeachingAssignment.findMany({
      where: {
        tenantId,
        staffProfileId,
        deletedAt: null,
        canAccessSubjectWorkspace: true,
      },
      select: { offeringSectionId: true, courseOfferingId: true },
    });

    const sectionIds = assignments
      .map((a) => a.offeringSectionId)
      .filter(Boolean) as string[];
    const offeringIds = [
      ...new Set(assignments.map((a) => a.courseOfferingId).filter(Boolean)),
    ] as string[];

    const workspaces = await this.prisma.lmsWorkspace.findMany({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { offeringSectionId: { in: sectionIds } },
          { workspaceType: 'POOL', courseOfferingId: { in: offeringIds } },
        ],
      },
      select: { id: true },
    });

    if (!workspaces.length) return 0;

    return this.prisma.lmsDiscussion.count({
      where: {
        tenantId,
        deletedAt: null,
        status: 'OPEN',
        workspaceId: { in: workspaces.map((w) => w.id) },
        NOT: { createdById: userId },
        replies: { some: { deletedAt: null } },
      },
    });
  }

  private async countPendingLessonPlans(
    tenantId: string,
    staffProfileId: string,
  ) {
    const assignments = await this.prisma.subjectTeachingAssignment.findMany({
      where: {
        tenantId,
        staffProfileId,
        deletedAt: null,
        canAccessSubjectWorkspace: true,
      },
      select: { offeringSectionId: true, courseOfferingId: true },
    });

    const sectionIds = assignments
      .map((a) => a.offeringSectionId)
      .filter(Boolean) as string[];
    const offeringIds = [
      ...new Set(assignments.map((a) => a.courseOfferingId).filter(Boolean)),
    ] as string[];

    const workspaces = await this.prisma.lmsWorkspace.findMany({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { offeringSectionId: { in: sectionIds } },
          { workspaceType: 'POOL', courseOfferingId: { in: offeringIds } },
        ],
      },
      select: { id: true },
    });

    if (!workspaces.length) return 0;

    return this.prisma.lmsLessonPlan.count({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ['NOT_STARTED', 'IN_PROGRESS'] },
        workspaceId: { in: workspaces.map((w) => w.id) },
      },
    });
  }

  async getSubjectAssignments(user: JwtUser) {
    const staff = await this.resolveStaffProfile(user.tid, user.sub);
    const assignments = await this.prisma.staffSubjectAssignment.findMany({
      where: { tenantId: user.tid, staffProfileId: staff.id },
      include: {
        course: { select: { id: true, code: true, title: true } },
        offeringSection: {
          select: {
            id: true,
            sectionCode: true,
            seatLedger: { select: { confirmedCount: true } },
          },
        },
        shift: { select: { id: true, code: true, name: true } },
        academicYear: { select: { id: true, name: true } },
      },
      orderBy: [{ semesterNo: 'asc' }, { createdAt: 'desc' }],
    });
    return assignments.map((a) => ({
      id: a.id,
      courseId: a.courseId,
      semesterNo: a.semesterNo,
      category: a.category,
      workloadHours: a.workloadHours,
      isPrimaryFaculty: a.isPrimaryFaculty,
      course: a.course,
      offeringSection: a.offeringSection,
      shift: a.shift,
      academicYear: a.academicYear,
      studentCount: a.offeringSection?.seatLedger?.confirmedCount ?? 0,
    }));
  }

  async getDocuments(user: JwtUser) {
    const staff = await this.resolveStaffProfile(user.tid, user.sub);
    return this.prisma.staffDocument.findMany({
      where: { tenantId: user.tid, staffProfileId: staff.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTodaySchedule(tenantId: string, staffProfileId: string) {
    const dayOfWeek = new Date().getDay();
    const entries = await this.prisma.timetableEntry.findMany({
      where: { tenantId, staffProfileId, dayOfWeek },
      orderBy: { startTime: 'asc' },
    });

    const results = [];
    for (const entry of entries) {
      let subject = 'Class';
      let sectionCode: string | null = null;
      let semesterNo: number | null = null;
      let classroom: string | null = null;

      if (entry.offeringSectionId) {
        const section = await this.prisma.offeringSection.findFirst({
          where: { id: entry.offeringSectionId },
          include: {
            courseOffering: {
              include: { course: { select: { code: true, title: true } } },
            },
            classroom: { select: { code: true, name: true } },
          },
        });
        if (section) {
          subject =
            section.courseOffering.course?.title ??
            section.courseOffering.course?.code ??
            subject;
          sectionCode = section.sectionCode;
          semesterNo = section.courseOffering.semesterSequence ?? null;
          classroom =
            section.classroom?.name ?? section.classroom?.code ?? null;
        }
      }

      if (entry.classroomId && !classroom) {
        const room = await this.prisma.classroom.findFirst({
          where: { id: entry.classroomId },
          select: { code: true, name: true },
        });
        classroom = room?.name ?? room?.code ?? null;
      }

      results.push({
        id: entry.id,
        startTime: formatTime(entry.startTime),
        endTime: formatTime(entry.endTime),
        subject,
        semesterNo,
        sectionCode,
        classroom,
        offeringSectionId: entry.offeringSectionId,
        status: entry.status,
      });
    }

    return results;
  }

  async getTodayScheduleForUser(user: JwtUser) {
    const staff = await this.resolveStaffProfile(user.tid, user.sub);
    return this.getTodaySchedule(user.tid, staff.id);
  }

  private async getLeaveKpi(tenantId: string, staffProfileId: string) {
    const year = new Date().getFullYear();
    const [balances, pending] = await Promise.all([
      this.prisma.staffLeaveBalance.findMany({
        where: { tenantId, staffProfileId, year },
        include: { leaveType: { select: { code: true } } },
      }),
      this.prisma.staffLeaveApplication.count({
        where: {
          tenantId,
          staffProfileId,
          status: { in: ['PENDING', 'HOD_APPROVED'] },
        },
      }),
    ]);
    const byCode: Record<string, number> = {};
    for (const b of balances) {
      const remaining =
        Number(b.allocatedDays) + Number(b.carriedForward) - Number(b.usedDays);
      byCode[b.leaveType.code.toUpperCase()] = remaining;
    }
    return {
      casual: byCode['CL'] ?? byCode['CASUAL'] ?? 0,
      sick: byCode['SL'] ?? byCode['SICK'] ?? byCode['MEDICAL'] ?? 0,
      earned: byCode['EL'] ?? byCode['EARNED'] ?? 0,
      pendingRequests: pending,
    };
  }
}
