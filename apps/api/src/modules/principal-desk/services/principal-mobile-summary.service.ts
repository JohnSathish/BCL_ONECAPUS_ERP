import { Injectable } from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { LeaveService } from '../../hr/services/leave.service';
import { PrincipalCommsMailboxService } from '../../principal-comms/services/principal-comms-mailbox.service';
import { StudentLeaveService } from '../../students/services/student-leave.service';
import { PrincipalDeskDashboardService } from './principal-desk-dashboard.service';

export type MobileAlertSeverity = 'critical' | 'high' | 'medium' | 'low';

@Injectable()
export class PrincipalMobileSummaryService {
  constructor(
    private readonly dashboard: PrincipalDeskDashboardService,
    private readonly mailbox: PrincipalCommsMailboxService,
    private readonly leave: LeaveService,
    private readonly studentLeave: StudentLeaveService,
  ) {}

  async getSummary(user: JwtUser) {
    const [desk, mail, staffLeave, studentLeave] = await Promise.all([
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
    ]);

    const pendingApprovals = staffLeave.length + studentLeave.length;
    const admissionsAction = desk.actions?.find(
      (a: { id: string }) => a.id === 'admissions' || a.id === 'registrations',
    );
    const admissionsToday = admissionsAction?.count ?? 0;

    const overview = {
      studentsPresent: desk.snapshot?.studentsPresentToday ?? 0,
      studentsAbsent: desk.snapshot?.studentsAbsentToday ?? 0,
      staffPresent: desk.snapshot?.staffPresentToday ?? 0,
      staffAbsent: desk.snapshot?.staffAbsentToday ?? 0,
      admissionsToday,
      feeCollectionToday: desk.finance?.todayCollection ?? 0,
      pendingApprovals,
      unreadEmails: mail.unread ?? 0,
      attendancePct: desk.academic?.studentAttendancePct ?? null,
    };

    const alerts = this.buildAlerts(desk, mail, pendingApprovals);
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

    const quickActions = [
      {
        id: 'approvals',
        label: 'Approve Leave',
        href: '/(principal)/(tabs)/approvals',
      },
      {
        id: 'inbox',
        label: 'Read Emails',
        href: '/(principal)/(tabs)/inbox',
      },
      {
        id: 'compose',
        label: 'Compose Email',
        href: '/(principal)/compose',
      },
      {
        id: 'calendar',
        label: 'Calendar',
        href: '/(principal)/(tabs)#schedule',
      },
      {
        id: 'attendance',
        label: 'Attendance',
        href: '/(principal)/(tabs)',
      },
      {
        id: 'notice',
        label: 'Send Notice',
        href: '/(principal)/compose',
      },
    ];

    return {
      greeting: {
        salutation:
          desk.intelligenceSummary?.salutation ??
          desk.greeting?.dayLabel ??
          'Good day',
        title: 'Principal',
        userName: desk.greeting?.userName ?? 'Principal',
        dateLabel: desk.greeting?.dateLabel ?? '',
      },
      institution: {
        academicYear: desk.institution?.academicYear ?? null,
        semester: desk.institution?.semester ?? null,
        studentCount: desk.institution?.studentCount ?? 0,
        staffCount: desk.institution?.staffCount ?? 0,
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
      quickActions,
      intelligence: {
        bullets: desk.intelligenceSummary?.bullets ?? desk.aiInsights ?? [],
      },
      campusHealth: desk.campusHealth ?? null,
      updatedAt: desk.updatedAt ?? new Date().toISOString(),
    };
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
        title: 'Leave approvals pending',
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
        title: 'Students below attendance threshold',
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
