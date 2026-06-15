import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import {
  CreateReplacementAssignmentDto,
  CreateSubstituteStaffDto,
  EndReplacementAssignmentDto,
  ReplacementAssignmentQueryDto,
  SubstituteStaffQueryDto,
  UpdateSubstituteStaffDto,
} from './dto/substitute-staff.dto';
import { SubstituteStaffService } from './services/substitute-staff.service';
import { ReplacementAssignmentService } from './services/replacement-assignment.service';

@ApiBearerAuth()
@ApiTags('hr-substitute')
@Controller({ path: 'hr/substitute', version: '1' })
export class SubstituteStaffController {
  constructor(
    private readonly substituteStaff: SubstituteStaffService,
    private readonly assignments: ReplacementAssignmentService,
  ) {}

  @Get('dashboard')
  @RequireAnyPermission('payroll:read', 'staff:read')
  dashboard(@CurrentUser() user: JwtUser) {
    return this.assignments.dashboardSummary(user.tid);
  }

  @Get('staff')
  @RequireAnyPermission('payroll:read', 'staff:read')
  listStaff(
    @CurrentUser() user: JwtUser,
    @Query() query: SubstituteStaffQueryDto,
  ) {
    return this.substituteStaff.list(user.tid, query);
  }

  @Post('staff')
  @RequireAnyPermission('payroll:manage', 'staff:manage')
  createStaff(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateSubstituteStaffDto,
  ) {
    return this.substituteStaff.create(user, dto);
  }

  @Get('staff/:id')
  @RequireAnyPermission('payroll:read', 'staff:read')
  getStaff(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.substituteStaff.get(user.tid, id);
  }

  @Patch('staff/:id')
  @RequireAnyPermission('payroll:manage', 'staff:manage')
  updateStaff(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateSubstituteStaffDto,
  ) {
    return this.substituteStaff.update(user, id, dto);
  }

  @Get('assignments')
  @RequireAnyPermission('payroll:read', 'staff:read')
  listAssignments(
    @CurrentUser() user: JwtUser,
    @Query() query: ReplacementAssignmentQueryDto,
  ) {
    return this.assignments.list(user.tid, query);
  }

  @Get('assignments/active/:staffProfileId')
  @RequireAnyPermission('payroll:read', 'staff:read')
  activeForStaff(
    @CurrentUser() user: JwtUser,
    @Param('staffProfileId') staffProfileId: string,
  ) {
    return this.assignments.getActiveForOriginalStaff(user.tid, staffProfileId);
  }

  @Post('assignments')
  @RequireAnyPermission('payroll:manage', 'staff:manage')
  createAssignment(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateReplacementAssignmentDto,
  ) {
    return this.assignments.create(user, dto);
  }

  @Post('assignments/:id/complete')
  @RequireAnyPermission('payroll:manage', 'staff:manage')
  completeAssignment(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: EndReplacementAssignmentDto,
  ) {
    return this.assignments.complete(user, id, dto);
  }

  @Post('assignments/:id/cancel')
  @RequireAnyPermission('payroll:manage', 'staff:manage')
  cancelAssignment(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: EndReplacementAssignmentDto,
  ) {
    return this.assignments.cancel(user, id, dto);
  }

  @Get('reports/:type')
  @RequirePermissions('payroll:reports')
  reports(
    @CurrentUser() user: JwtUser,
    @Param('type') type: 'active' | 'study-leave' | 'history',
  ) {
    return this.assignments.reports(user.tid, type);
  }

  @Post('assignments/process-expiry')
  @RequireAnyPermission('payroll:manage', 'staff:manage')
  processExpiry(@CurrentUser() user: JwtUser) {
    return this.assignments.processExpiringAssignments(user.tid);
  }
}
