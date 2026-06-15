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
    const [dashboard, config] = await Promise.all([
      this.studentPortal.getDashboard(user),
      this.settings.getConfigPayload(user.tid, 'STUDENT'),
    ]);
    const enabledCards = Object.entries(config.dashboardCards)
      .filter(([, on]) => on)
      .map(([key]) => key);
    return {
      profile: dashboard.profile,
      quickStats: dashboard.quickStats,
      fees: dashboard.fees,
      unreadNotificationCount: dashboard.unreadNotificationCount,
      enabledCards,
      dashboardCards: config.dashboardCards,
    };
  }

  async staffHome(user: JwtUser) {
    const [dashboard, me, config, todaySchedule] = await Promise.all([
      this.staffPortal.getDashboard(user),
      this.staffPortal.getMe(user),
      this.settings.getConfigPayload(user.tid, 'STAFF'),
      this.staffPortal.getTodayScheduleForUser(user),
    ]);
    const enabledCards = Object.entries(config.dashboardCards)
      .filter(([, on]) => on)
      .map(([key]) => key);
    const dash = dashboard as {
      unreadNotificationCount?: number;
      kpis?: { leave?: unknown; tasks?: { attendancePending?: number } };
    };
    return {
      profile: {
        staffId: me.id,
        fullName: me.fullName,
        employeeCode: me.employeeCode,
        photoUrl: me.photoUrl,
        department: me.department,
        designation: me.designation,
      },
      todayClasses: todaySchedule,
      pendingAttendanceCount: dash.kpis?.tasks?.attendancePending ?? 0,
      leaveBalance: dash.kpis?.leave ?? null,
      unreadNotificationCount: dash.unreadNotificationCount ?? 0,
      enabledCards,
      dashboardCards: config.dashboardCards,
    };
  }
}
