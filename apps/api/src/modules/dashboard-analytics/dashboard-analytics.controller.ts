import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Body,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import { DASHBOARD_WIDGET_PERMISSIONS } from '../../common/permissions/permission-registry';
import { DashboardAnalyticsService } from './dashboard-analytics.service';
import { DashboardFiltersDto } from './dto/dashboard-filters.dto';
import { DashboardAiAskDto } from './dto/ai-ask.dto';

function userCanWidget(user: JwtUser, widgetId: string): boolean {
  const required = DASHBOARD_WIDGET_PERMISSIONS[widgetId];
  if (!required?.length) return true;
  if (
    user.roles.some((r) =>
      ['college-admin', 'super-admin', 'university-admin'].includes(r),
    )
  ) {
    return true;
  }
  return required.some((p) => user.permissions.includes(p));
}

@ApiBearerAuth()
@ApiTags('dashboard')
@RequireAnyPermission(
  'reports:read',
  'academic:read',
  'academic:manage',
  'students:read',
  'fees:read',
  'front-office:read',
  'library:read',
)
@Controller({ path: 'dashboard', version: '1' })
export class DashboardAnalyticsController {
  constructor(private readonly dashboard: DashboardAnalyticsService) {}

  @Get('overview')
  overview(
    @CurrentUser() user: JwtUser,
    @Query() filters: DashboardFiltersDto,
  ) {
    return this.dashboard.getOverview(user.tid, filters, user);
  }

  @Get('operations')
  operations(
    @CurrentUser() user: JwtUser,
    @Query() filters: DashboardFiltersDto,
  ) {
    return this.dashboard.getOperationsCenter(user.tid, filters, user);
  }

  @Post('ai/ask')
  askAi(@CurrentUser() user: JwtUser, @Body() dto: DashboardAiAskDto) {
    return this.dashboard.askAssistant(user.tid, dto.question, user);
  }

  @Get('charts/:widgetId')
  chart(
    @CurrentUser() user: JwtUser,
    @Param('widgetId') widgetId: string,
    @Query() filters: DashboardFiltersDto,
  ) {
    if (!userCanWidget(user, widgetId)) {
      throw new ForbiddenException(
        `Dashboard widget not permitted: ${widgetId}`,
      );
    }
    return this.dashboard.getChart(user.tid, widgetId, filters);
  }

  @Get('shift-intelligence')
  shiftIntelligence(
    @CurrentUser() user: JwtUser,
    @Query() filters: DashboardFiltersDto,
  ) {
    if (!userCanWidget(user, 'shift-attendance')) {
      throw new ForbiddenException('Shift intelligence not permitted');
    }
    return this.dashboard.getShiftIntelligence(user.tid, filters);
  }
}
