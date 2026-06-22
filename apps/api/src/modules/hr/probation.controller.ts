import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import { ProbationService } from './services/probation.service';

@ApiBearerAuth()
@ApiTags('hr-probation')
@Controller({ path: 'hr/probation', version: '1' })
export class ProbationController {
  constructor(private readonly probation: ProbationService) {}

  @Get('dashboard')
  @RequireAnyPermission('hr:appointment:read', 'staff:manage', 'payroll:read')
  dashboard(@CurrentUser() user: JwtUser) {
    return this.probation.dashboard(user.tid);
  }

  @Get()
  @RequireAnyPermission('hr:appointment:read', 'staff:manage', 'payroll:read')
  list(@CurrentUser() user: JwtUser, @Query('withinDays') withinDays?: string) {
    return this.probation.listNearingEnd(
      user.tid,
      withinDays ? Number(withinDays) : 30,
    );
  }

  @Patch(':staffProfileId/confirm')
  @RequireAnyPermission('hr:appointment:manage', 'staff:manage')
  confirm(
    @CurrentUser() user: JwtUser,
    @Param('staffProfileId') staffProfileId: string,
  ) {
    return this.probation.confirm(user.tid, staffProfileId);
  }
}
