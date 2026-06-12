import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
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
  AllotQuarterDto,
  CreateMonthlyChargeDto,
  CreateQuarterDto,
  CreateQuarterTypeDto,
  OccupancyHistoryQueryDto,
  QuarterListQueryDto,
  UpdateQuarterDto,
  VacateQuarterDto,
} from './dto/accommodation.dto';
import { QuarterMasterService } from './services/quarter-master.service';
import { QuarterAllotmentService } from './services/quarter-allotment.service';
import { QuarterChargesService } from './services/quarter-charges.service';
import { AccommodationDashboardService } from './services/accommodation-dashboard.service';
import { AccommodationReportsService } from './services/accommodation-reports.service';
import { AccommodationAuditService } from './services/accommodation-audit.service';

@ApiBearerAuth()
@ApiTags('accommodation')
@Controller({ path: 'accommodation', version: '1' })
export class AccommodationController {
  constructor(
    private readonly quarters: QuarterMasterService,
    private readonly allotment: QuarterAllotmentService,
    private readonly charges: QuarterChargesService,
    private readonly dashboard: AccommodationDashboardService,
    private readonly reports: AccommodationReportsService,
    private readonly audit: AccommodationAuditService,
  ) {}

  @Get('dashboard')
  @RequireAnyPermission('accommodation:read', 'accommodation:manage')
  getDashboard(@CurrentUser() user: JwtUser) {
    return this.dashboard.getDashboard(user.tid);
  }

  @Get('quarter-types')
  @RequireAnyPermission('accommodation:read', 'accommodation:manage')
  listTypes(@CurrentUser() user: JwtUser) {
    return this.quarters.listTypes(user.tid);
  }

  @Post('quarter-types')
  @RequirePermissions('accommodation:manage')
  createType(@CurrentUser() user: JwtUser, @Body() dto: CreateQuarterTypeDto) {
    return this.quarters.createType(user, dto.name, dto.slug);
  }

  @Get('quarters')
  @RequireAnyPermission('accommodation:read', 'accommodation:manage')
  listQuarters(
    @CurrentUser() user: JwtUser,
    @Query() query: QuarterListQueryDto,
  ) {
    return this.quarters.list(user.tid, query);
  }

  @Get('quarters/available/list')
  @RequireAnyPermission('accommodation:read', 'accommodation:manage')
  listAvailable(@CurrentUser() user: JwtUser) {
    return this.allotment.listAvailable(user.tid);
  }

  @Get('quarters/:id')
  @RequireAnyPermission('accommodation:read', 'accommodation:manage')
  getQuarter(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.quarters.get(user.tid, id);
  }

  @Post('quarters')
  @RequirePermissions('accommodation:manage')
  createQuarter(@CurrentUser() user: JwtUser, @Body() dto: CreateQuarterDto) {
    return this.quarters.create(user, dto);
  }

  @Patch('quarters/:id')
  @RequirePermissions('accommodation:manage')
  updateQuarter(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateQuarterDto,
  ) {
    return this.quarters.update(user, id, dto);
  }

  @Post('quarters/:id/archive')
  @RequirePermissions('accommodation:manage')
  archiveQuarter(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.quarters.archive(user, id);
  }

  @Post('quarters/:id/maintenance')
  @RequirePermissions('accommodation:manage')
  markMaintenance(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.quarters.setStatus(user, id, 'MAINTENANCE');
  }

  @Post('quarters/:id/vacant')
  @RequirePermissions('accommodation:manage')
  markVacant(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.quarters.setStatus(user, id, 'VACANT');
  }

  @Get('staff/search')
  @RequireAnyPermission('accommodation:read', 'accommodation:manage')
  searchStaff(@CurrentUser() user: JwtUser, @Query('q') q: string) {
    return this.allotment.searchStaff(user.tid, q ?? '');
  }

  @Post('allotments')
  @RequirePermissions('accommodation:manage')
  allot(@CurrentUser() user: JwtUser, @Body() dto: AllotQuarterDto) {
    return this.allotment.allot(user, dto);
  }

  @Post('allotments/:id/vacate')
  @RequirePermissions('accommodation:manage')
  vacate(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: VacateQuarterDto,
  ) {
    return this.allotment.vacate(user, id, dto);
  }

  @Get('occupancies')
  @RequireAnyPermission('accommodation:read', 'accommodation:manage')
  history(
    @CurrentUser() user: JwtUser,
    @Query() query: OccupancyHistoryQueryDto,
  ) {
    return this.allotment.history(user.tid, query);
  }

  @Get('staff/:staffProfileId')
  @RequireAnyPermission(
    'accommodation:read',
    'accommodation:manage',
    'staff:read',
  )
  staffAccommodation(
    @CurrentUser() user: JwtUser,
    @Param('staffProfileId') staffProfileId: string,
  ) {
    return this.allotment.getStaffAccommodation(user.tid, staffProfileId);
  }

  @Get('charges')
  @RequireAnyPermission('accommodation:read', 'accommodation:manage')
  listCharges(
    @CurrentUser() user: JwtUser,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('status') status?: string,
    @Query('staffProfileId') staffProfileId?: string,
  ) {
    return this.charges.list(user.tid, {
      month: month ? Number(month) : undefined,
      year: year ? Number(year) : undefined,
      status,
      staffProfileId,
    });
  }

  @Post('charges')
  @RequirePermissions('accommodation:manage')
  createCharge(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateMonthlyChargeDto,
  ) {
    return this.charges.create(user, dto);
  }

  @Delete('charges/:id')
  @RequirePermissions('accommodation:manage')
  removeCharge(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.charges.remove(user, id);
  }

  @Get('reports/occupancy')
  @RequireAnyPermission('accommodation:reports', 'accommodation:read')
  reportOccupancy(
    @CurrentUser() user: JwtUser,
    @Query('status') status?: string,
  ) {
    return this.reports.occupancyReport(user.tid, status);
  }

  @Get('reports/staff-register')
  @RequireAnyPermission('accommodation:reports', 'accommodation:read')
  reportStaffRegister(@CurrentUser() user: JwtUser) {
    return this.reports.staffRegister(user.tid);
  }

  @Get('reports/history')
  @RequireAnyPermission('accommodation:reports', 'accommodation:read')
  reportHistory(
    @CurrentUser() user: JwtUser,
    @Query('quarterId') quarterId?: string,
  ) {
    return this.reports.historyReport(user.tid, quarterId);
  }

  @Get('reports/department-wise')
  @RequireAnyPermission('accommodation:reports', 'accommodation:read')
  reportDepartment(@CurrentUser() user: JwtUser) {
    return this.reports.departmentWise(user.tid);
  }

  @Get('reports/payroll-recovery')
  @RequireAnyPermission('accommodation:reports', 'payroll:reports')
  reportPayrollRecovery(
    @CurrentUser() user: JwtUser,
    @Query('month') month: string,
    @Query('year') year: string,
    @Query('componentCode') componentCode?: string,
  ) {
    return this.reports.payrollRecoveryReport(
      user.tid,
      Number(month),
      Number(year),
      componentCode,
    );
  }

  @Get('reports/occupancy/export.xlsx')
  @RequireAnyPermission('accommodation:reports', 'accommodation:read')
  async exportOccupancy(
    @CurrentUser() user: JwtUser,
    @Res() res: Response,
    @Query('status') status?: string,
  ) {
    const buf = await this.reports.exportOccupancyExcel(user.tid, status);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=quarter-occupancy.xlsx',
    );
    res.send(buf);
  }

  @Get('reports/staff-register/export.xlsx')
  @RequireAnyPermission('accommodation:reports', 'accommodation:read')
  async exportStaffRegister(
    @CurrentUser() user: JwtUser,
    @Res() res: Response,
  ) {
    const buf = await this.reports.exportStaffRegisterExcel(user.tid);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=staff-accommodation-register.xlsx',
    );
    res.send(buf);
  }

  @Get('reports/payroll-recovery/export.xlsx')
  @RequireAnyPermission('accommodation:reports', 'payroll:reports')
  async exportPayrollRecovery(
    @CurrentUser() user: JwtUser,
    @Res() res: Response,
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    const buf = await this.reports.exportPayrollRecoveryExcel(
      user.tid,
      Number(month),
      Number(year),
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=accommodation-recovery-${month}-${year}.xlsx`,
    );
    res.send(buf);
  }

  @Get('audit-logs')
  @RequireAnyPermission('accommodation:manage', 'accommodation:reports')
  auditLogs(
    @CurrentUser() user: JwtUser,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
  ) {
    return this.audit.list(user.tid, entityType, entityId);
  }
}
