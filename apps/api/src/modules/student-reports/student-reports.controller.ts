import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import {
  StudentReportExportDto,
  StudentReportFiltersDto,
} from './dto/student-reports.dto';
import { StudentReportsExportService } from './services/student-reports-export.service';
import { StudentReportsService } from './services/student-reports.service';

@ApiBearerAuth()
@ApiTags('student-reports')
@RequireAnyPermission('reports:read', 'students:read')
@Controller({ path: 'student-reports', version: '1' })
export class StudentReportsController {
  constructor(
    private readonly reports: StudentReportsService,
    private readonly exportService: StudentReportsExportService,
  ) {}

  @Get('dashboard')
  dashboard(
    @CurrentUser() user: JwtUser,
    @Query() filters: StudentReportFiltersDto,
  ) {
    return this.reports.getDashboard(user.tid, filters, user);
  }

  @Get('strength')
  strength(
    @CurrentUser() user: JwtUser,
    @Query() filters: StudentReportFiltersDto,
  ) {
    return this.reports.getStrengthReport(user.tid, filters, user);
  }

  @Get('department')
  department(
    @CurrentUser() user: JwtUser,
    @Query() filters: StudentReportFiltersDto,
  ) {
    return this.reports.getDepartmentStrength(user.tid, filters, user);
  }

  @Get('gender')
  gender(
    @CurrentUser() user: JwtUser,
    @Query() filters: StudentReportFiltersDto,
  ) {
    return this.reports.getGenderReport(user.tid, filters, user);
  }

  @Get('category')
  category(
    @CurrentUser() user: JwtUser,
    @Query() filters: StudentReportFiltersDto,
  ) {
    return this.reports.getCategoryReport(user.tid, filters, user);
  }

  @Get('religion')
  religion(
    @CurrentUser() user: JwtUser,
    @Query() filters: StudentReportFiltersDto,
  ) {
    return this.reports.getReligionReport(user.tid, filters, user);
  }

  @Get('denomination')
  denomination(
    @CurrentUser() user: JwtUser,
    @Query() filters: StudentReportFiltersDto,
  ) {
    return this.reports.getDenominationReport(user.tid, filters, user);
  }

  @Get('major-subjects')
  majorSubjects(
    @CurrentUser() user: JwtUser,
    @Query() filters: StudentReportFiltersDto,
  ) {
    return this.reports.getDepartmentSubjectsReport(user.tid, filters, user);
  }

  @Get('combinations')
  combinations(
    @CurrentUser() user: JwtUser,
    @Query() filters: StudentReportFiltersDto,
  ) {
    return this.reports.getCombinationsReport(user.tid, filters, user);
  }

  @Get('mdc')
  mdc(@CurrentUser() user: JwtUser, @Query() filters: StudentReportFiltersDto) {
    return this.reports.getNepBucketReport(user.tid, 'MDC', filters, user);
  }

  @Get('aec')
  aec(@CurrentUser() user: JwtUser, @Query() filters: StudentReportFiltersDto) {
    return this.reports.getNepBucketReport(user.tid, 'AEC', filters, user);
  }

  @Get('sec')
  sec(@CurrentUser() user: JwtUser, @Query() filters: StudentReportFiltersDto) {
    return this.reports.getNepBucketReport(user.tid, 'SEC', filters, user);
  }

  @Get('vac')
  vac(@CurrentUser() user: JwtUser, @Query() filters: StudentReportFiltersDto) {
    return this.reports.getNepBucketReport(user.tid, 'VAC', filters, user);
  }

  @Get('age')
  age(@CurrentUser() user: JwtUser, @Query() filters: StudentReportFiltersDto) {
    return this.reports.getAgeReport(user.tid, filters, user);
  }

  @Get('blood-group')
  bloodGroup(
    @CurrentUser() user: JwtUser,
    @Query() filters: StudentReportFiltersDto,
  ) {
    return this.reports.getBloodGroupReport(user.tid, filters, user);
  }

  @Get('admission')
  admission(
    @CurrentUser() user: JwtUser,
    @Query() filters: StudentReportFiltersDto,
  ) {
    return this.reports.getAdmissionReport(user.tid, filters, user);
  }

  @Get('contact')
  contact(
    @CurrentUser() user: JwtUser,
    @Query() filters: StudentReportFiltersDto,
  ) {
    return this.reports.getContactReport(user.tid, filters, user);
  }

  @Get('export')
  async exportGet(
    @CurrentUser() user: JwtUser,
    @Query() dto: StudentReportExportDto,
    @Res() res: Response,
  ) {
    const result = await this.exportService.export(user.tid, dto, user);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    res.send(result.buffer);
  }

  @Post('export')
  async exportReport(
    @CurrentUser() user: JwtUser,
    @Body() dto: StudentReportExportDto,
    @Res() res: Response,
  ) {
    const result = await this.exportService.export(user.tid, dto, user);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    res.send(result.buffer);
  }
}
