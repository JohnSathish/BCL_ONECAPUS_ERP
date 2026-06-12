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

@ApiBearerAuth()
@ApiTags('reports')
@Controller({ path: 'reports', version: '1' })
export class ReportsController {
  constructor(
    private readonly shifts: ShiftsService,
    private readonly shiftScope: ShiftScopeService,
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
}
