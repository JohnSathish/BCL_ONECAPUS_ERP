import {
  Body,
  Controller,
  Delete,
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
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { ShiftScoped } from '../../common/decorators/shift-scoped.decorator';
import { ShiftScopeService } from '../../common/services/shift-scope.service';
import {
  AssignShiftAdminByEmailDto,
  AssignShiftAdminDto,
  CreateShiftDto,
  ReorderShiftsDto,
  UpdateShiftDto,
} from './dto/shifts.dto';
import { ShiftAssignmentsService } from './shift-assignments.service';
import { ShiftsService } from './shifts.service';

@ApiBearerAuth()
@ApiTags('shifts')
@Controller({ path: 'shifts', version: '1' })
export class ShiftsController {
  constructor(
    private readonly shifts: ShiftsService,
    private readonly assignments: ShiftAssignmentsService,
    private readonly shiftScope: ShiftScopeService,
  ) {}

  @Get()
  @RequirePermissions('shift:read')
  list(
    @CurrentUser() user: JwtUser,
    @Query('campusId') campusId?: string,
    @Query('institutionId') institutionId?: string,
    @Query('status') status?: string,
  ) {
    return this.shifts.list(user.tid, { campusId, institutionId, status });
  }

  @Get('operations/summary')
  @RequirePermissions('shift:reports:read')
  @ShiftScoped()
  operationsSummary(
    @CurrentUser() user: JwtUser,
    @Query('campusId') campusId?: string,
  ) {
    return this.shifts.operationsSummary(user, campusId);
  }

  @Get('summary')
  @RequirePermissions('shift:reports:read')
  @ShiftScoped()
  summary(
    @CurrentUser() user: JwtUser,
    @Query('campusId') campusId?: string,
    @Query('shiftId') shiftId?: string,
  ) {
    const scope = this.shiftScope.resolveScope(user, shiftId);
    return this.shifts.shiftSummary(user.tid, scope, campusId);
  }

  @Get('institutions/:institutionId')
  @RequirePermissions('shift:read')
  listByInstitution(
    @CurrentUser() user: JwtUser,
    @Param('institutionId') institutionId: string,
    @Query('campusId') campusId?: string,
    @Query('status') status?: string,
  ) {
    return this.shifts.listByInstitution(
      user.tid,
      institutionId,
      campusId,
      status,
    );
  }

  @Post('reorder')
  @RequirePermissions('shift:manage')
  reorder(@CurrentUser() user: JwtUser, @Body() dto: ReorderShiftsDto) {
    return this.shifts.reorder(user.tid, dto.shiftIds);
  }

  @Get('admin-users')
  @RequirePermissions('shift:manage')
  listAdminCandidates(
    @CurrentUser() user: JwtUser,
    @Query('search') search?: string,
  ) {
    return this.assignments.listAdminCandidates(user.tid, search);
  }

  @Get(':id/admins')
  @RequirePermissions('shift:manage')
  listAdmins(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.assignments.listForShift(user.tid, id);
  }

  @Post(':id/admins')
  @RequirePermissions('shift:manage')
  assignAdmin(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: AssignShiftAdminDto,
  ) {
    return this.assignments.assign(
      user.tid,
      id,
      dto.userId,
      dto.isPrimary ?? false,
    );
  }

  @Post(':id/admins/by-email')
  @RequirePermissions('shift:manage')
  assignAdminByEmail(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: AssignShiftAdminByEmailDto,
  ) {
    return this.assignments.assignByEmail(user.tid, id, dto.email, {
      isPrimary: dto.isPrimary,
      createIfMissing: dto.createIfMissing,
      password: dto.password,
    });
  }

  @Delete(':id/admins/:userId')
  @RequirePermissions('shift:manage')
  unassignAdmin(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.assignments.unassign(user.tid, id, userId);
  }

  @Get(':id')
  @RequirePermissions('shift:read')
  get(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.shifts.get(user.tid, id);
  }

  @Post()
  @RequirePermissions('shift:manage')
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateShiftDto) {
    return this.shifts.create(user.tid, dto, user.sub);
  }

  @Patch(':id')
  @RequirePermissions('shift:manage')
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateShiftDto,
  ) {
    return this.shifts.update(user.tid, id, dto);
  }

  @Post(':id/activate')
  @RequirePermissions('shift:manage')
  activate(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.shifts.activate(user.tid, id);
  }

  @Post(':id/deactivate')
  @RequirePermissions('shift:manage')
  deactivate(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.shifts.deactivate(user.tid, id);
  }

  @Delete(':id')
  @RequirePermissions('shift:manage')
  remove(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.shifts.softDelete(user.tid, id);
  }
}
