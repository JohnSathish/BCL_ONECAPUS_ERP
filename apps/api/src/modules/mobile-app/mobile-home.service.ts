import { Injectable } from '@nestjs/common';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { StudentPortalService } from '../students/services/student-portal.service';
import { StaffPortalService } from '../staff/services/staff-portal.service';
import { MobileAppSettingsService } from './mobile-app-settings.service';

@Injectable()
export class MobileHomeService {
  constructor(
    private readonly studentPortal: StudentPortalService,
    private readonly staffPortal: StaffPortalService,
    private readonly settings: MobileAppSettingsService,
  ) {}

  async studentHome(user: JwtUser) {
    const [dashboard, config, calendarEvents] = await Promise.all([
      this.studentPortal.getDashboard(user),
      this.settings.getConfigPayload(user.tid, 'STUDENT'),
      this.studentPortal.getDashboardWidgetCalendar(user).catch(() => []),
    ]);
    const enabledCards = Object.entries(config.dashboardCards)
      .filter(([, on]) => on)
      .map(([key]) => key);
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = (calendarEvents ?? [])
      .filter((ev) => ev.date >= today)
      .slice(0, 12);
    return {
      profile: {
        ...dashboard.profile,
        programName:
          dashboard.profile.programLabel ?? dashboard.profile.department,
        semesterLabel:
          dashboard.profile.semesterSequence != null
            ? `Semester ${dashboard.profile.semesterSequence}`
            : null,
        photoUrl: dashboard.profile.photoUrl ?? null,
      },
      quickStats: dashboard.quickStats,
      fees: dashboard.fees,
      academicChips: dashboard.academicChips,
      attendance: {
        percentage: dashboard.quickStats?.find((s) => s.key === 'attendance')
          ?.value
          ? parseFloat(
              String(
                dashboard.quickStats.find((s) => s.key === 'attendance')
                  ?.value ?? '0',
              ).replace('%', ''),
            )
          : null,
      },
      unreadNotificationCount: dashboard.unreadNotificationCount,
      calendarEvents: upcoming,
      enabledCards,
      dashboardCards: config.dashboardCards,
    };
  }

  async studentAcademics(user: JwtUser) {
    return this.studentPortal.getMobileAcademics(user);
  }

  async staffHome(user: JwtUser) {
    const [dashboard, config] = await Promise.all([
      this.staffPortal.getDashboard(user),
      this.settings.getConfigPayload(user.tid, 'STAFF'),
    ]);
    const enabledCards = Object.entries(config.dashboardCards)
      .filter(([, on]) => on)
      .map(([key]) => key);

    const tasks = dashboard.kpis?.tasks;
    const leave = dashboard.kpis?.leave;
    const salary = dashboard.kpis?.salary;
    const todaySchedule = dashboard.todaySchedule ?? [];

    const pendingActions = [
      ...(tasks?.attendancePending
        ? [
            {
              id: 'attendance',
              tone: 'urgent' as const,
              label: 'Attendance Pending',
              count: tasks.attendancePending,
            },
          ]
        : []),
      ...(tasks?.lmsPendingEvaluations
        ? [
            {
              id: 'marks',
              tone: 'warning' as const,
              label: 'Marks Pending',
              count: tasks.lmsPendingEvaluations,
            },
          ]
        : []),
      ...(tasks?.pendingLessonPlans
        ? [
            {
              id: 'lesson-plan',
              tone: 'pending' as const,
              label: 'Lesson Plan Due',
              count: tasks.pendingLessonPlans,
            },
          ]
        : []),
      ...(dashboard.lmsTasks?.assignmentsToEvaluate
        ? [
            {
              id: 'assignments',
              tone: 'info' as const,
              label: 'Assignment Submission',
              count: dashboard.lmsTasks.assignmentsToEvaluate,
            },
          ]
        : []),
      ...(leave?.pendingRequests
        ? [
            {
              id: 'leave',
              tone: 'success' as const,
              label: 'Leave Approval Pending',
              count: leave.pendingRequests,
            },
          ]
        : []),
    ];

    return {
      profile: {
        staffId: dashboard.profile.id,
        fullName: dashboard.profile.fullName,
        employeeCode: dashboard.profile.employeeCode,
        photoUrl: dashboard.profile.photoUrl,
        department: dashboard.profile.department,
        designation: dashboard.profile.designation,
        greeting: dashboard.profile.greeting,
        email: dashboard.profile.email,
        experienceYears: dashboard.profile.experienceYears,
        joiningDate: dashboard.profile.joiningDate,
        isTeaching: dashboard.profile.isTeaching,
        isHod: dashboard.profile.isHod,
      },
      academicContext: dashboard.academicContext,
      todayClasses: todaySchedule,
      workloadSummary: {
        classesToday: todaySchedule.length,
        attendancePending: tasks?.attendancePending ?? 0,
        marksPending: tasks?.lmsPendingEvaluations ?? 0,
        lessonPlansPending: tasks?.pendingLessonPlans ?? 0,
        assignmentsPending: dashboard.lmsTasks?.assignmentsToEvaluate ?? 0,
        meetingsUpcoming: tasks?.governanceUpcomingMeetings ?? 0,
      },
      pendingActions,
      myClasses: (dashboard.subjects ?? []).map((subject) => ({
        id: subject.id,
        courseTitle: subject.courseTitle,
        courseCode: subject.courseCode,
        semesterNo: subject.semesterNo,
        sectionCode: subject.sectionCode,
        offeringSectionId: subject.offeringSectionId,
        studentCount: subject.studentCount,
        weeklyHours: subject.weeklyHours,
        canMarkAttendance: subject.canMarkAttendance,
        canEnterInternalMarks: subject.canEnterInternalMarks,
      })),
      analytics: {
        staffAttendancePercent: dashboard.kpis?.attendance?.percentage ?? null,
        attendanceSubmittedPercent:
          dashboard.performanceSnapshot?.attendanceSubmittedPercent ?? null,
        studentsTaught: dashboard.performanceSnapshot?.studentsTaught ?? 0,
        assignedSubjects: dashboard.performanceSnapshot?.assignedSubjects ?? 0,
      },
      notifications: (dashboard.notifications ?? []).slice(0, 8),
      departmentNotices: (dashboard.departmentNotices ?? []).slice(0, 4),
      unreadNotificationCount: dashboard.unreadNotificationCount ?? 0,
      leaveBalance: {
        casual: leave?.casual ?? 0,
        sick: leave?.sick ?? 0,
        earned: leave?.earned ?? 0,
      },
      payroll: {
        amount: salary?.currentMonthSalary ?? 0,
        currency: salary?.currency ?? 'INR',
        status: salary?.payslipAvailable ? 'Credited' : 'Processing',
        payslipAvailable: salary?.payslipAvailable ?? false,
        lastPaymentDate: salary?.lastPaymentDate,
      },
      performance: dashboard.performanceSnapshot,
      calendarEvents: (dashboard.calendarEvents ?? []).slice(0, 6),
      teachingLoad: dashboard.kpis?.teachingLoad,
      enabledCards,
      dashboardCards: config.dashboardCards,
    };
  }
}
