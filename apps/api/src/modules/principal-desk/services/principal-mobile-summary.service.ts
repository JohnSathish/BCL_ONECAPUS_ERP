import { Injectable } from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { toPublicUploadUrl } from '../../../common/uploads/public-upload-url';
import { PrismaService } from '../../../database/prisma.service';
import { LeaveService } from '../../hr/services/leave.service';
import { PrincipalCommsMailboxService } from '../../principal-comms/services/principal-comms-mailbox.service';
import { StudentLeaveService } from '../../students/services/student-leave.service';
import { PrincipalDeskDashboardService } from './principal-desk-dashboard.service';

export type MobileAlertSeverity = 'critical' | 'high' | 'medium' | 'low';

@Injectable()
export class PrincipalMobileSummaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboard: PrincipalDeskDashboardService,
    private readonly mailbox: PrincipalCommsMailboxService,
    private readonly leave: LeaveService,
    private readonly studentLeave: StudentLeaveService,
  ) {}

  async getSummary(user: JwtUser) {
    const [desk, mail, staffLeave, studentLeave, catalog, principalProfile] =
      await Promise.all([
        this.dashboard.getDashboard(user),
        this.mailbox.stats(user.tid, user.sub).catch(() => ({
          connected: false,
          unread: 0,
          starred: 0,
          today: 0,
          university: 0,
          government: 0,
        })),
        this.leave
          .listApplications(user.tid, { status: 'PENDING' })
          .catch(() => [] as unknown[]),
        this.studentLeave.listPending(user.tid).catch(() => [] as unknown[]),
        this.loadCatalogCounts(user.tid),
        this.resolvePrincipalProfile(user),
      ]);

    const pendingApprovals = staffLeave.length + studentLeave.length;
    const admissionsAction = desk.actions?.find(
      (a: { id: string }) => a.id === 'admissions' || a.id === 'registrations',
    );
    const admissionsToday = admissionsAction?.count ?? 0;

    const studentsPresent = desk.snapshot?.studentsPresentToday ?? 0;
    const studentsAbsent = desk.snapshot?.studentsAbsentToday ?? 0;
    const staffPresent = desk.snapshot?.staffPresentToday ?? 0;
    const staffAbsent = desk.snapshot?.staffAbsentToday ?? 0;
    const studentTotal = desk.institution?.studentCount ?? 0;
    const staffTotal = desk.institution?.staffCount ?? 0;
    const studentsPct =
      desk.academic?.studentAttendancePct ??
      (studentsPresent + studentsAbsent > 0
        ? Math.round(
            (studentsPresent / (studentsPresent + studentsAbsent)) * 1000,
          ) / 10
        : null);
    const staffPct =
      desk.academic?.facultyAttendancePct ??
      (staffPresent + staffAbsent > 0
        ? Math.round((staffPresent / (staffPresent + staffAbsent)) * 1000) / 10
        : null);
    const overallPct =
      studentsPct != null && staffPct != null
        ? Math.round(((studentsPct + staffPct) / 2) * 10) / 10
        : (studentsPct ?? staffPct ?? null);

    const feeToday = desk.finance?.todayCollection ?? 0;
    const feeMonth = desk.finance?.monthCollection ?? feeToday;
    const sparkline: number[] = Array.isArray(desk.finance?.collectionSparkline)
      ? desk.finance.collectionSparkline
      : [];
    const feeTrendPct = this.sparklineTrendPct(sparkline);

    const departmentCount = catalog.departments;
    const programs = catalog.programs;
    const subjects = catalog.courses;
    const semestersRunning =
      Array.isArray(desk.institution?.activeSemesters) &&
      desk.institution.activeSemesters.length > 0
        ? desk.institution.activeSemesters.length
        : desk.institution?.semester
          ? 1
          : catalog.activeSemesters;
    const classesToday =
      desk.snapshot?.classesConductedToday ??
      desk.academic?.classesCompleted ??
      desk.academic?.classesScheduled ??
      0;

    const shiftCount = catalog.shifts;
    const overview = {
      studentsPresent,
      studentsAbsent,
      staffPresent,
      staffAbsent,
      admissionsToday,
      feeCollectionToday: feeToday,
      feeCollectionMonth: feeMonth,
      pendingApprovals,
      unreadEmails: mail.unread ?? 0,
      attendancePct: overallPct,
      studentsAttendancePct: studentsPct,
      staffAttendancePct: staffPct,
      classesToday,
      departmentCount,
      programCount: programs,
      subjectCount: subjects,
      semestersRunning,
      shiftCount,
      feeTrendPct,
      notificationCount:
        (mail.unread ?? 0) +
        pendingApprovals +
        (desk.navBadges?.leavePending ?? 0),
    };

    const alerts = this.buildAlerts(desk, mail, pendingApprovals).map((a) => ({
      ...a,
      actionHint: this.alertActionHint(a.id, a.severity),
    }));

    const schedule = (desk.eventTimeline ?? [])
      .slice(0, 8)
      .map(
        (item: {
          dayGroup: string;
          time: string;
          label: string;
          href?: string;
        }) => ({
          dayGroup: item.dayGroup,
          time: item.time,
          label: item.label,
          href: this.toMobileHref(item.href),
        }),
      );

    const notices = (desk.announcements ?? [])
      .slice(0, 5)
      .map(
        (
          item: { title: string; date: string; href?: string },
          index: number,
        ) => ({
          id: `notice-${index}`,
          title: item.title,
          dateLabel: item.date,
          tag: index === 0 ? 'New' : 'Notice',
          href: this.toMobileHref(item.href),
        }),
      );

    const quickActions = [
      {
        id: 'notice',
        label: 'Create Notice',
        href: '/(principal)/compose',
        icon: 'megaphone',
      },
      {
        id: 'calendar',
        label: 'Schedule Meeting',
        href: '/(principal)/(tabs)#schedule',
        icon: 'calendar',
      },
      {
        id: 'reports',
        label: 'View Reports',
        href: '/(principal)/(tabs)',
        icon: 'document',
      },
      {
        id: 'approvals',
        label: 'Approve Leave',
        href: '/(principal)/(tabs)/approvals',
        icon: 'person',
      },
      {
        id: 'inbox',
        label: 'Message Center',
        href: '/(principal)/(tabs)/inbox',
        icon: 'chat',
      },
      {
        id: 'circulars',
        label: 'Circulars',
        href: '/(principal)/(tabs)/inbox',
        icon: 'list',
      },
    ];

    return {
      greeting: {
        salutation:
          desk.intelligenceSummary?.salutation ??
          desk.greeting?.dayLabel ??
          'Good day',
        title: 'Principal',
        userName:
          principalProfile.fullName || desk.greeting?.userName || 'Principal',
        photoUrl: principalProfile.photoUrl,
        dateLabel: desk.greeting?.dateLabel ?? '',
      },
      institution: {
        academicYear: desk.institution?.academicYear ?? null,
        semester: desk.institution?.semester ?? null,
        studentCount: studentTotal,
        staffCount: staffTotal,
      },
      overview,
      mail: {
        connected: Boolean(mail.connected),
        unread: mail.unread ?? 0,
        today: mail.today ?? 0,
        googleEmail: (mail as { googleEmail?: string }).googleEmail ?? null,
      },
      alerts,
      schedule,
      notices,
      quickActions,
      intelligence: {
        bullets: desk.intelligenceSummary?.bullets ?? desk.aiInsights ?? [],
      },
      campusHealth: desk.campusHealth ?? null,
      updatedAt: desk.updatedAt ?? new Date().toISOString(),
    };
  }

  private async loadCatalogCounts(tenantId: string) {
    const [departments, programs, courses, shifts, activeSemesters] =
      await Promise.all([
        this.prisma.department.count({
          where: { tenantId, deletedAt: null },
        }),
        this.prisma.program.count({
          where: { tenantId, deletedAt: null },
        }),
        this.prisma.course.count({
          where: { tenantId, deletedAt: null },
        }),
        this.prisma.shift.count({
          where: { tenantId, deletedAt: null, status: 'ACTIVE' },
        }),
        this.prisma.semester.count({
          where: { tenantId, deletedAt: null, isActive: true },
        }),
      ]);
    return { departments, programs, courses, shifts, activeSemesters };
  }

  private async resolvePrincipalProfile(user: JwtUser): Promise<{
    fullName: string | null;
    photoUrl: string | null;
  }> {
    const portalUser = await this.prisma.user.findFirst({
      where: { id: user.sub, tenantId: user.tid, deletedAt: null },
      select: {
        displayName: true,
        email: true,
        staffProfile: {
          select: { fullName: true, photoUrl: true },
        },
      },
    });

    let fullName = portalUser?.staffProfile?.fullName?.trim() || null;
    let photoUrl = toPublicUploadUrl(portalUser?.staffProfile?.photoUrl);

    if ((!fullName || !photoUrl) && portalUser?.email) {
      const byEmail = await this.prisma.staffProfile.findFirst({
        where: {
          tenantId: user.tid,
          deletedAt: null,
          email: { equals: portalUser.email, mode: 'insensitive' },
        },
        select: { fullName: true, photoUrl: true },
      });
      if (!fullName) fullName = byEmail?.fullName?.trim() || null;
      if (!photoUrl) photoUrl = toPublicUploadUrl(byEmail?.photoUrl);
    }

    if (!fullName) {
      fullName = portalUser?.displayName?.trim() || null;
    }

    return { fullName, photoUrl };
  }

  private sparklineTrendPct(sparkline: number[]) {
    if (sparkline.length < 2) return null;
    const prev = sparkline[sparkline.length - 2] ?? 0;
    const curr = sparkline[sparkline.length - 1] ?? 0;
    if (prev <= 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 1000) / 10;
  }

  private alertActionHint(id: string, severity: MobileAlertSeverity) {
    if (id === 'leave-pending') return 'Review now';
    if (id === 'attendance-risk') return 'Action required';
    if (severity === 'critical') return 'Action required';
    if (severity === 'high') return 'Review now';
    return 'Check now';
  }

  private buildAlerts(
    desk: Awaited<ReturnType<PrincipalDeskDashboardService['getDashboard']>>,
    mail: { unread?: number; university?: number; connected?: boolean },
    pendingApprovals: number,
  ) {
    const alerts: Array<{
      id: string;
      title: string;
      severity: MobileAlertSeverity;
      href: string;
      count?: number;
    }> = [];

    if ((mail.university ?? 0) > 0) {
      alerts.push({
        id: 'university-mail',
        title: 'University circular / mail',
        severity: 'critical',
        href: '/(principal)/(tabs)/inbox',
        count: mail.university,
      });
    }
    if ((mail.unread ?? 0) > 0) {
      alerts.push({
        id: 'unread-mail',
        title: 'Unread emails',
        severity: 'high',
        href: '/(principal)/(tabs)/inbox',
        count: mail.unread,
      });
    }
    if (pendingApprovals > 0) {
      alerts.push({
        id: 'leave-pending',
        title: `${pendingApprovals} leave request${pendingApprovals === 1 ? '' : 's'} pending approval`,
        severity: 'high',
        href: '/(principal)/(tabs)/approvals',
        count: pendingApprovals,
      });
    }

    const ca = desk.criticalAlerts;
    if (ca?.feeDefaulters?.count > 0) {
      alerts.push({
        id: 'fee-defaulters',
        title: 'Fee defaulters need attention',
        severity: 'critical',
        href: '/(principal)/(tabs)',
        count: ca.feeDefaulters.count,
      });
    }
    if (ca?.attendanceRisk?.count > 0) {
      alerts.push({
        id: 'attendance-risk',
        title: `${ca.attendanceRisk.count} students have irregular attendance`,
        severity: 'high',
        href: '/(principal)/(tabs)',
        count: ca.attendanceRisk.count,
      });
    }
    if (ca?.staffAbsentToday?.count > 0) {
      alerts.push({
        id: 'staff-absent',
        title: 'Staff absent today',
        severity: 'medium',
        href: '/(principal)/(tabs)',
        count: ca.staffAbsentToday.count,
      });
    }
    if (ca?.committeeMeetingsToday?.count > 0) {
      alerts.push({
        id: 'meetings-today',
        title: 'Committee meetings today',
        severity: 'medium',
        href: '/(principal)/(tabs)#schedule',
        count: ca.committeeMeetingsToday.count,
      });
    }

    for (const action of desk.actions ?? []) {
      if (alerts.length >= 8) break;
      if (
        ['leave', 'admissions', 'fees', 'registrations'].includes(action.id)
      ) {
        const exists = alerts.some((a) => a.id === action.id);
        if (exists) continue;
        alerts.push({
          id: action.id,
          title: action.message,
          severity:
            action.priority === 'critical'
              ? 'critical'
              : action.priority === 'high'
                ? 'high'
                : 'medium',
          href: this.toMobileHref(action.href),
          count: action.count,
        });
      }
    }

    const rank: Record<MobileAlertSeverity, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    return alerts
      .sort((a, b) => rank[a.severity] - rank[b.severity])
      .slice(0, 8);
  }

  private toMobileHref(webHref?: string | null): string {
    if (!webHref) return '/(principal)/(tabs)';
    const h = webHref.toLowerCase();
    if (h.includes('communication-hub') || h.includes('mail')) {
      return '/(principal)/(tabs)/inbox';
    }
    if (h.includes('leave')) return '/(principal)/(tabs)/approvals';
    if (
      h.includes('event') ||
      h.includes('calendar') ||
      h.includes('committee')
    ) {
      return '/(principal)/(tabs)#schedule';
    }
    return '/(principal)/(tabs)';
  }
}
