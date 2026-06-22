import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import { CreateJoiningReportDto } from './dto/appointment-order.dto';
import { JoiningReportService } from './services/joining-report.service';

@ApiBearerAuth()
@ApiTags('hr-joining-reports')
@Controller({ path: 'hr/joining-reports', version: '1' })
export class JoiningReportController {
  constructor(private readonly reports: JoiningReportService) {}

  @Get()
  @RequireAnyPermission(
    'hr:joining:verify',
    'hr:appointment:read',
    'staff:manage',
  )
  list(@CurrentUser() user: JwtUser, @Query('status') status?: string) {
    return this.reports.list(user.tid, status);
  }

  @Get('accepted-orders')
  @RequireAnyPermission(
    'hr:joining:verify',
    'hr:appointment:read',
    'staff:manage',
  )
  acceptedOrders(@CurrentUser() user: JwtUser) {
    return this.reports.listAcceptedOrdersWithoutReport(user.tid);
  }

  @Get(':id')
  @RequireAnyPermission(
    'hr:joining:verify',
    'hr:appointment:read',
    'staff:manage',
  )
  get(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.reports.get(user.tid, id);
  }

  @Post()
  @RequireAnyPermission('hr:joining:verify', 'staff:manage')
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateJoiningReportDto) {
    return this.reports.create(user, dto);
  }

  @Post(':id/verify')
  @RequirePermissions('hr:joining:verify')
  verify(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.reports.verify(user, id);
  }
}
