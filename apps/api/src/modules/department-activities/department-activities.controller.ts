import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import {
  MarkAttendanceDto,
  TransitionActivityStatusDto,
  UpsertDepartmentActivityDto,
} from './dto/department-activities.dto';
import { DepartmentActivitiesService } from './services/department-activities.service';

@Controller('department-activities')
export class DepartmentActivitiesController {
  constructor(private readonly service: DepartmentActivitiesService) {}

  @Get('types')
  @RequireAnyPermission(
    'department-activities:read',
    'department-activities:manage',
    'department-activities:self',
  )
  listTypes() {
    return this.service.listActivityTypes();
  }

  @Get('dashboard')
  @RequireAnyPermission(
    'department-activities:read',
    'department-activities:manage',
    'department-activities:approve',
  )
  dashboard(@CurrentUser() user: JwtUser) {
    return this.service.dashboard(user);
  }

  @Get('open')
  @RequireAnyPermission('department-activities:self', 'student:portal:self')
  openForStudents(@CurrentUser() user: JwtUser) {
    return this.service.openForStudents(user);
  }

  @Get('mine')
  @RequireAnyPermission('department-activities:self', 'student:portal:self')
  myRegistrations(@CurrentUser() user: JwtUser) {
    return this.service.myRegistrations(user);
  }

  @Get()
  @RequireAnyPermission(
    'department-activities:read',
    'department-activities:manage',
    'department-activities:approve',
  )
  listActivities(
    @CurrentUser() user: JwtUser,
    @Query('departmentId') departmentId?: string,
    @Query('status') status?: string,
    @Query('upcoming') upcoming?: string,
  ) {
    return this.service.listActivities(user, {
      departmentId,
      status,
      upcoming: upcoming === 'true' || upcoming === '1',
    });
  }

  @Get(':id')
  @RequireAnyPermission(
    'department-activities:read',
    'department-activities:manage',
    'department-activities:approve',
    'department-activities:self',
    'student:portal:self',
  )
  getActivity(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.getActivity(user, id);
  }

  @Post()
  @RequirePermissions('department-activities:manage')
  createActivity(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpsertDepartmentActivityDto,
  ) {
    return this.service.createActivity(user, dto);
  }

  @Patch(':id')
  @RequirePermissions('department-activities:manage')
  updateActivity(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpsertDepartmentActivityDto,
  ) {
    return this.service.updateActivity(user, id, dto);
  }

  @Post(':id/status')
  @RequireAnyPermission(
    'department-activities:manage',
    'department-activities:approve',
  )
  transitionStatus(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: TransitionActivityStatusDto,
  ) {
    return this.service.transitionStatus(user, id, dto);
  }

  @Post(':id/register')
  @RequireAnyPermission('department-activities:self', 'student:portal:self')
  register(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.registerStudent(user, id);
  }

  @Post(':id/withdraw')
  @RequireAnyPermission('department-activities:self', 'student:portal:self')
  withdraw(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.withdrawRegistration(user, id);
  }

  @Get(':id/registrations')
  @RequireAnyPermission(
    'department-activities:read',
    'department-activities:manage',
    'department-activities:attend',
    'department-activities:approve',
  )
  listRegistrations(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.listRegistrations(user, id);
  }

  @Post(':id/attendance')
  @RequireAnyPermission(
    'department-activities:attend',
    'department-activities:manage',
  )
  markAttendance(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: MarkAttendanceDto,
  ) {
    return this.service.markAttendance(user, id, dto);
  }

  @Post(':id/attendance/finalize')
  @RequirePermissions('department-activities:manage')
  finalizeAttendance(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.finalizeAttendance(user, id);
  }

  @Post(':id/certificates/participation')
  @RequireAnyPermission(
    'department-activities:certificates',
    'department-activities:manage',
  )
  issueParticipationCertificates(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
  ) {
    return this.service.issueParticipationCertificates(user, id);
  }
}
