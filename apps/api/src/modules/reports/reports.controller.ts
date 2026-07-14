import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import { ShiftScoped } from '../../common/decorators/shift-scoped.decorator';
import { ShiftScopeService } from '../../common/services/shift-scope.service';
import { ShiftsService } from '../shifts/shifts.service';
import { ShiftReportsService } from './shift-reports.service';

@ApiBearerAuth()
@ApiTags('reports')
@Controller({ path: 'reports', version: '1' })
export class ReportsController {
  constructor(
    private readonly shifts: ShiftsService,
    private readonly shiftScope: ShiftScopeService,
    private readonly shiftReports: ShiftReportsService,
  ) {}

  @Get('shift-summary')
  @RequireAnyPermission('shift:reports:read', 'reports:read')
  @ShiftScoped()
  shiftSummary(
    @CurrentUser() user: JwtUser,
    @Query('campusId') campusId?: string,
    @Query('shiftId') shiftId?: string,
  ) {
    const scope = this.shiftScope.resolveScope(user, shiftId);
    return this.shifts.shiftSummary(user.tid, scope, campusId);
  }

  @Get('shift-operations')
  @RequireAnyPermission('shift:reports:read', 'reports:read', 'shift:read')
  @ShiftScoped()
  shiftOperations(
    @CurrentUser() user: JwtUser,
    @Query('shiftId') shiftId?: string,
  ) {
    return this.shiftReports.pack(user, shiftId);
  }
}
