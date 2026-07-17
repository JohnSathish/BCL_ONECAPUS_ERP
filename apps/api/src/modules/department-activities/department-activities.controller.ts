import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import {
  AddMediaDto,
  MarkAttendanceDto,
  ReviewPresentationDto,
  SubmitPresentationDto,
  TransitionActivityStatusDto,
  UpsertActivityReportDto,
  UpsertDepartmentActivityDto,
  UpsertResultsDto,
} from './dto/department-activities.dto';
import { DepartmentActivitiesPhase2Service } from './services/department-activities-phase2.service';
import { DepartmentActivitiesService } from './services/department-activities.service';

@Controller('department-activities')
export class DepartmentActivitiesController {
  constructor(
    private readonly service: DepartmentActivitiesService,
    private readonly phase2: DepartmentActivitiesPhase2Service,
  ) {}

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

  @Get('reports/summary')
  @RequireAnyPermission(
    'department-activities:read',
    'department-activities:manage',
    'department-activities:approve',
  )
  reportsSummary(
    @CurrentUser() user: JwtUser,
    @Query('departmentId') departmentId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.phase2.reportsSummary(user, { departmentId, from, to });
  }

  @Get('reports/csv')
  @RequireAnyPermission(
    'department-activities:read',
    'department-activities:manage',
    'department-activities:approve',
  )
  @Header('Content-Type', 'text/csv; charset=utf-8')
  reportsCsv(
    @CurrentUser() user: JwtUser,
    @Query('departmentId') departmentId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.phase2.reportsCsv(user, { departmentId, from, to });
  }

  @Post('presentations/:presentationId/review')
  @RequirePermissions('department-activities:manage')
  reviewPresentation(
    @CurrentUser() user: JwtUser,
    @Param('presentationId') presentationId: string,
    @Body() dto: ReviewPresentationDto,
  ) {
    return this.phase2.reviewPresentation(user, presentationId, dto);
  }

  @Delete('media/:mediaId')
  @RequirePermissions('department-activities:manage')
  removeMedia(@CurrentUser() user: JwtUser, @Param('mediaId') mediaId: string) {
    return this.phase2.removeMedia(user, mediaId);
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
  async transitionStatus(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: TransitionActivityStatusDto,
  ) {
    let activity = await this.service.transitionStatus(user, id, dto);
    if (dto.status === 'OPEN') {
      activity = await this.phase2.onActivityOpened(user, activity);
    } else if (dto.status === 'COMPLETED') {
      activity = await this.phase2.onActivityCompleted(user, activity);
    }
    return activity;
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

  @Get(':id/results')
  @RequireAnyPermission(
    'department-activities:read',
    'department-activities:manage',
    'department-activities:approve',
  )
  listResults(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.phase2.listResults(user, id);
  }

  @Put(':id/results')
  @RequirePermissions('department-activities:manage')
  upsertResults(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpsertResultsDto,
  ) {
    return this.phase2.upsertResults(user, id, dto);
  }

  @Post(':id/certificates/awards')
  @RequireAnyPermission(
    'department-activities:certificates',
    'department-activities:manage',
  )
  issueAwardCertificates(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
  ) {
    return this.phase2.issueAwardCertificates(user, id);
  }

  @Get(':id/presentations')
  @RequireAnyPermission(
    'department-activities:read',
    'department-activities:manage',
    'department-activities:approve',
    'department-activities:self',
    'student:portal:self',
  )
  listPresentations(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.phase2.listPresentations(user, id);
  }

  @Post(':id/presentations')
  @RequireAnyPermission('department-activities:self', 'student:portal:self')
  submitPresentation(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SubmitPresentationDto,
  ) {
    return this.phase2.submitPresentation(user, id, dto);
  }

  @Get(':id/media')
  @RequireAnyPermission(
    'department-activities:read',
    'department-activities:manage',
    'department-activities:approve',
  )
  listMedia(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.phase2.listMedia(user, id);
  }

  @Post(':id/media')
  @RequirePermissions('department-activities:manage')
  addMedia(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: AddMediaDto,
  ) {
    return this.phase2.addMedia(user, id, dto);
  }

  @Patch(':id/report')
  @RequirePermissions('department-activities:manage')
  updateReport(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpsertActivityReportDto,
  ) {
    return this.phase2.updateReport(user, id, dto);
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
