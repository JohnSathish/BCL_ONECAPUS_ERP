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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import {
  BuiltinReportQueryDto,
  CreateSavedReportDto,
  CreateScheduledReportDto,
  ExecuteCustomReportDto,
  RunSavedReportDto,
  TabularReportExportDto,
  UpdateSavedReportDto,
} from './dto/custom-report.dto';
import {
  StudentReportExportDto,
  StudentReportFiltersDto,
} from './dto/student-reports.dto';
import { CustomReportService } from './services/custom-report.service';
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
    private readonly customReports: CustomReportService,
  ) {}

  @Get('field-registry')
  fieldRegistry(@Query('module') module?: string) {
    return this.customReports.listFieldRegistry(module ?? 'STUDENTS');
  }

  @Get('builtin-templates')
  builtinTemplates() {
    return this.customReports.listBuiltinTemplates();
  }

  @Get('saved')
  listSaved(@CurrentUser() user: JwtUser, @Query('module') module?: string) {
    return this.customReports.listSavedReports(user.tid, user.sub, module);
  }

  @Post('saved')
  createSaved(@CurrentUser() user: JwtUser, @Body() dto: CreateSavedReportDto) {
    return this.customReports.createSavedReport(user.tid, user.sub, dto);
  }

  @Patch('saved/:id')
  updateSaved(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateSavedReportDto,
  ) {
    return this.customReports.updateSavedReport(user.tid, user.sub, id, dto);
  }

  @Delete('saved/:id')
  deleteSaved(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.customReports.deleteSavedReport(user.tid, id);
  }

  @Post('saved/:id/favorite')
  toggleFavorite(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.customReports.toggleFavorite(user.tid, user.sub, id);
  }

  @Get('saved/:id/preview')
  savedPreview(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Query() overrides: RunSavedReportDto,
  ) {
    return this.customReports.executeSavedReport(user.tid, id, overrides, user);
  }

  @Get('saved/:id/export')
  async savedExportGet(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Query() dto: RunSavedReportDto,
    @Res() res: Response,
  ) {
    await this.sendExport(
      res,
      this.customReports.exportSavedReport(user.tid, id, dto, user),
    );
  }

  @Post('saved/:id/export')
  async savedExport(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: RunSavedReportDto,
    @Res() res: Response,
  ) {
    await this.sendExport(
      res,
      this.customReports.exportSavedReport(user.tid, id, dto, user),
    );
  }

  @Get('scheduled')
  listScheduled(
    @CurrentUser() user: JwtUser,
    @Query('module') module?: string,
  ) {
    return this.customReports.listScheduledReports(user.tid, module);
  }

  @Post('scheduled')
  createScheduled(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateScheduledReportDto,
  ) {
    return this.customReports.createScheduledReport(user.tid, user.sub, dto);
  }

  @Delete('scheduled/:id')
  deleteScheduled(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.customReports.deleteScheduledReport(user.tid, id);
  }

  @Get('master/preview')
  masterPreview(
    @CurrentUser() user: JwtUser,
    @Query() query: BuiltinReportQueryDto,
  ) {
    const { columns, limit, ...filters } = query;
    return this.customReports.previewBuiltin(
      user.tid,
      'student-master',
      filters,
      user,
      columns,
    );
  }

  @Get('master/export')
  async masterExportGet(
    @CurrentUser() user: JwtUser,
    @Query() dto: TabularReportExportDto,
    @Res() res: Response,
  ) {
    await this.sendExport(
      res,
      this.customReports.exportBuiltin(user.tid, 'student-master', dto, user),
    );
  }

  @Post('master/export')
  async masterExport(
    @CurrentUser() user: JwtUser,
    @Body() dto: TabularReportExportDto,
    @Res() res: Response,
  ) {
    await this.sendExport(
      res,
      this.customReports.exportBuiltin(user.tid, 'student-master', dto, user),
    );
  }

  @Get('subject-summary/preview')
  subjectSummaryPreview(
    @CurrentUser() user: JwtUser,
    @Query() filters: StudentReportFiltersDto,
  ) {
    return this.customReports.previewBuiltin(
      user.tid,
      'subject-summary',
      filters,
      user,
    );
  }

  @Get('subject-summary/export')
  async subjectSummaryExportGet(
    @CurrentUser() user: JwtUser,
    @Query() dto: TabularReportExportDto,
    @Res() res: Response,
  ) {
    await this.sendExport(
      res,
      this.customReports.exportBuiltin(user.tid, 'subject-summary', dto, user),
    );
  }

  @Post('subject-summary/export')
  async subjectSummaryExport(
    @CurrentUser() user: JwtUser,
    @Body() dto: TabularReportExportDto,
    @Res() res: Response,
  ) {
    await this.sendExport(
      res,
      this.customReports.exportBuiltin(user.tid, 'subject-summary', dto, user),
    );
  }

  @Get('subject-papers/preview')
  subjectPapersPreview(
    @CurrentUser() user: JwtUser,
    @Query() filters: StudentReportFiltersDto,
  ) {
    return this.customReports.previewBuiltin(
      user.tid,
      'subject-papers',
      filters,
      user,
    );
  }

  @Get('subject-papers/export')
  async subjectPapersExportGet(
    @CurrentUser() user: JwtUser,
    @Query() dto: TabularReportExportDto,
    @Res() res: Response,
  ) {
    await this.sendExport(
      res,
      this.customReports.exportBuiltin(user.tid, 'subject-papers', dto, user),
    );
  }

  @Post('subject-papers/export')
  async subjectPapersExport(
    @CurrentUser() user: JwtUser,
    @Body() dto: TabularReportExportDto,
    @Res() res: Response,
  ) {
    await this.sendExport(
      res,
      this.customReports.exportBuiltin(user.tid, 'subject-papers', dto, user),
    );
  }

  @Post('custom/preview')
  customPreview(
    @CurrentUser() user: JwtUser,
    @Body() dto: ExecuteCustomReportDto,
  ) {
    const { format: _format, name: _name, ...rest } = dto;
    return this.customReports.executeCustom(user.tid, rest, user);
  }

  @Post('custom/export')
  async customExport(
    @CurrentUser() user: JwtUser,
    @Body() dto: ExecuteCustomReportDto,
    @Res() res: Response,
  ) {
    await this.sendExport(
      res,
      this.customReports.exportCustom(user.tid, dto, user),
    );
  }

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

  private async sendExport(
    res: Response,
    promise: Promise<{
      buffer: Buffer;
      contentType: string;
      filename: string;
    }>,
  ) {
    const result = await promise;
    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    res.send(result.buffer);
  }
}
