import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { LmsAnnouncementsService } from './services/lms-announcements.service';
import { LmsDashboardService } from './services/lms-dashboard.service';
import { LmsOpenCoursesService } from './services/lms-open-courses.service';
import { LmsProviderRouterService } from './adapters/lms-provider-router.service';

@ApiBearerAuth()
@ApiTags('lms')
@Controller({ path: 'lms/me', version: '1' })
export class LmsPortalController {
  constructor(
    private readonly dashboard: LmsDashboardService,
    private readonly announcements: LmsAnnouncementsService,
    private readonly openCourses: LmsOpenCoursesService,
    private readonly providerRouter: LmsProviderRouterService,
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

  @Get('open-courses')
  @RequirePermissions('lms:read')
  myOpenCourses(@CurrentUser() user: JwtUser) {
    return this.openCourses.listForPortal(user);
  }

  @Get('open-courses/:id/launch')
  @RequirePermissions('lms:read')
  launchOpenCourse(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.openCourses.launchForPortal(user, id);
  }

  @Get('workspaces/:workspaceId/launch')
  @RequirePermissions('lms:read')
  async launchWorkspace(
    @CurrentUser() user: JwtUser,
    @Param('workspaceId') workspaceId: string,
  ) {
    const url = await this.providerRouter.getLaunchUrl(user, workspaceId);
    return { url };
  }
}
