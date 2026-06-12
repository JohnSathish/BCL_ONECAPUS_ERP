import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { LmsAnnouncementsService } from './services/lms-announcements.service';
import { LmsDashboardService } from './services/lms-dashboard.service';

@ApiBearerAuth()
@ApiTags('lms')
@Controller({ path: 'lms/me', version: '1' })
export class LmsPortalController {
  constructor(
    private readonly dashboard: LmsDashboardService,
    private readonly announcements: LmsAnnouncementsService,
  ) {}

  @Get('workspaces')
  @RequirePermissions('lms:read')
  myWorkspaces(@CurrentUser() user: JwtUser) {
    return this.dashboard.myWorkspaces(user);
  }

  @Get('dashboard')
  @RequirePermissions('lms:read')
  async myDashboard(@CurrentUser() user: JwtUser) {
    if (user.roles.includes('student')) {
      return this.dashboard.studentDashboard(user);
    }
    return this.dashboard.facultyDashboard(user);
  }

  @Get('announcements')
  @RequirePermissions('lms:read')
  myAnnouncements(@CurrentUser() user: JwtUser) {
    return this.announcements.list(user);
  }
}
