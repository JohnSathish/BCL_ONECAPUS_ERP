import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import { PAYROLL_READ_ACCESS } from '../../common/permissions/payroll.permissions';
import {
  CreateArrearBatchDto,
  CreateIncrementBatchDto,
  CreatePayrollRunDto,
  CreatePaySalaryComponentDto,
  CreatePayStructureDto,
  UpdatePayStructureDto,
  CreatePayslipAdjustmentDto,
  CreateSalaryRevisionDto,
  CreateStaffLoanDto,
  CreateStaffPayAssignmentDto,
  ExcludeStaffFromRunDto,
  UpdatePayAssignmentStatutoryDto,
  BulkStaffPayAssignmentDto,
  ListPayAssignmentsQueryDto,
  FormulaPreviewDto,
  PayrollQueryDto,
  UpdatePaySalaryComponentDto,
  UpsertStaffPfConfigDto,
  BulkStaffPfConfigDto,
} from './dto/payroll.dto';
import { ArrearsService } from './services/arrears.service';
import { FormulaEngineService } from './services/formula-engine.service';
import { IncrementService } from './services/increment.service';
import { LoanService } from './services/loan.service';
import { PayStructureService } from './services/pay-structure.service';
import { PayrollAnalyticsService } from './services/payroll-analytics.service';
import { PayrollApprovalService } from './services/payroll-approval.service';
import { PayrollReportsService } from './services/payroll-reports.service';
import { PayrollRunEngineService } from './services/payroll-run-engine.service';
import { PayslipDocumentService } from './services/payslip-document.service';
import { PfCpfService } from './services/pf-cpf.service';
import { SalaryComponentService } from './services/salary-component.service';
import { PayAssignmentImportService } from './services/pay-assignment-import.service';
import { StaffPayAssignmentService } from './services/staff-pay-assignment.service';
import { StaffPfConfigService } from './services/staff-pf-config.service';
import { PayrollAuditService } from './services/payroll-audit.service';
import { PayrollAdjustmentsService } from './services/payroll-adjustments.service';
import { ProfessionalTaxService } from './services/professional-tax.service';
import { TdsService } from './services/tds.service';
import { PayslipNotificationService } from './services/payslip-notification.service';
import { PayslipsService } from './services/payslips.service';
import { PrismaService } from '../../database/prisma.service';

@ApiBearerAuth()
@ApiTags('payroll')
@Controller({ path: 'payroll', version: '1' })
export class PayrollController {
  constructor(
    private readonly components: SalaryComponentService,
    private readonly structures: PayStructureService,
    private readonly assignments: StaffPayAssignmentService,
    private readonly increments: IncrementService,
    private readonly loans: LoanService,
    private readonly runs: PayrollRunEngineService,
    private readonly approval: PayrollApprovalService,
    private readonly payslipDocs: PayslipDocumentService,
    private readonly pfCpf: PfCpfService,
    private readonly arrears: ArrearsService,
    private readonly reports: PayrollReportsService,
    private readonly analytics: PayrollAnalyticsService,
    private readonly formula: FormulaEngineService,
    private readonly prisma: PrismaService,
    private readonly assignmentImport: PayAssignmentImportService,
    private readonly staffPfConfig: StaffPfConfigService,
    private readonly payrollAudit: PayrollAuditService,
    private readonly payrollAdjustments: PayrollAdjustmentsService,
    private readonly professionalTax: ProfessionalTaxService,
    private readonly tds: TdsService,
    private readonly payslipNotify: PayslipNotificationService,
    private readonly payslips: PayslipsService,
  ) {}

  @Get('dashboard/executive')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS)
  executiveDashboard(@CurrentUser() user: JwtUser) {
    return this.analytics.executiveDashboard(user.tid);
  }

  @Get('dashboard')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS)
  dashboard(@CurrentUser() user: JwtUser) {
    return this.analytics.dashboard(user.tid);
  }

  // Components
  @Get('components')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS)
  listComponents(@CurrentUser() user: JwtUser, @Query('type') type?: string) {
    return this.components.list(user.tid, type);
  }

  @Post('components')
  @RequirePermissions('payroll:manage')
  createComponent(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreatePaySalaryComponentDto,
  ) {
    return this.components.create(user.tid, dto);
  }

  @Patch('components/:id')
  @RequirePermissions('payroll:manage')
  updateComponent(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdatePaySalaryComponentDto,
  ) {
    return this.components.update(user.tid, id, dto);
  }

  // Structures
  @Get('structures')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS)
  listStructures(
    @CurrentUser() user: JwtUser,
    @Query('structureType') structureType?: string,
  ) {
    return this.structures.list(user.tid, structureType);
  }

  @Get('structures/:id')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS)
  getStructure(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.structures.get(user.tid, id);
  }

  @Post('structures')
  @RequirePermissions('payroll:manage')
  createStructure(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreatePayStructureDto,
  ) {
    return this.structures.create(user.tid, dto);
  }

  @Patch('structures/:id')
  @RequirePermissions('payroll:manage')
  updateStructure(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdatePayStructureDto,
  ) {
    return this.structures.update(user.tid, id, dto);
  }

  @Post('structures/:id/preview')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS)
  previewStructure(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body()
    body: { basicPay: number; componentOverrides?: Record<string, unknown> },
  ) {
    return this.structures.previewStructure(
      user.tid,
      id,
      body.basicPay,
      body.componentOverrides as never,
    );
  }

  @Post('formula/preview')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS)
  previewFormula(@Body() dto: FormulaPreviewDto) {
    return this.structures.previewFormula(dto);
  }

  @Get('professional-tax/preview')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS)
  previewProfessionalTax(
    @CurrentUser() user: JwtUser,
    @Query('grossSalary') grossSalary: string,
    @Query('month') month: string,
  ) {
    return this.prisma.payrollSettings
      .findUnique({ where: { tenantId: user.tid } })
      .then((settings) =>
        this.professionalTax.preview(
          Number(grossSalary),
          Number(month),
          settings?.professionalTaxSlabs,
        ),
      );
  }

  @Get('tds/preview')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS)
  previewTds(
    @CurrentUser() user: JwtUser,
    @Query('monthlyGross') monthlyGross: string,
  ) {
    return this.prisma.payrollSettings
      .findUnique({ where: { tenantId: user.tid } })
      .then((settings) =>
        this.tds.preview(Number(monthlyGross), settings?.tdsSlabs),
      );
  }

  // Assignments
  @Get('assignments/stats')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS)
  assignmentStats(@CurrentUser() user: JwtUser) {
    return this.assignments.stats(user.tid);
  }

  @Get('assignments')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS)
  listAssignments(
    @CurrentUser() user: JwtUser,
    @Query() query: ListPayAssignmentsQueryDto,
  ) {
    return this.assignments.list(user.tid, query);
  }

  @Post('assignments')
  @RequirePermissions('payroll:manage')
  createAssignment(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateStaffPayAssignmentDto,
  ) {
    return this.assignments.create(user, dto);
  }

  @Post('assignments/bulk')
  @RequirePermissions('payroll:manage')
  bulkAssignments(
    @CurrentUser() user: JwtUser,
    @Body() dto: BulkStaffPayAssignmentDto,
  ) {
    return this.assignments.bulkCreate(user, dto);
  }

  @Patch('assignments/:id/archive')
  @RequirePermissions('payroll:manage')
  archiveAssignment(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.assignments.archive(user, id);
  }

  @Patch('assignments/:id/statutory')
  @RequirePermissions('payroll:manage')
  updateAssignmentStatutory(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdatePayAssignmentStatutoryDto,
  ) {
    return this.assignments.updateStatutory(user, id, dto);
  }

  @Post('assignments/backfill')
  @RequirePermissions('payroll:manage')
  backfillAssignments(@CurrentUser() user: JwtUser) {
    return this.assignments.backfillFromProfiles(user.tid, user.sub);
  }

  @Get('assignments/import/template')
  @RequirePermissions('payroll:manage')
  async assignmentImportTemplate(@Res() res: Response) {
    const buffer = await this.assignmentImport.downloadTemplate();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=pay-assignment-import-template.xlsx',
    );
    res.send(buffer);
  }

  @Post('assignments/import/validate')
  @RequirePermissions('payroll:manage')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  validateAssignmentImport(
    @CurrentUser() user: JwtUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file?.buffer?.length)
      throw new BadRequestException('No file uploaded');
    return this.assignmentImport.validate(user, file.buffer);
  }

  @Post('assignments/import/commit')
  @RequirePermissions('payroll:manage')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  commitAssignmentImport(
    @CurrentUser() user: JwtUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file?.buffer?.length)
      throw new BadRequestException('No file uploaded');
    return this.assignmentImport.commit(user, file.buffer);
  }

  // Revisions
  @Get('revisions')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS)
  listRevisions(
    @CurrentUser() user: JwtUser,
    @Query('staffProfileId') staffProfileId?: string,
  ) {
    return this.assignments.listRevisions(user.tid, staffProfileId);
  }

  @Post('revisions')
  @RequirePermissions('payroll:manage')
  createRevision(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateSalaryRevisionDto,
  ) {
    return this.assignments.createRevision(user, dto);
  }

  // Increments
  @Get('increments')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS)
  listIncrements(@CurrentUser() user: JwtUser) {
    return this.increments.list(user.tid);
  }

  @Post('increments')
  @RequirePermissions('payroll:manage')
  createIncrement(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateIncrementBatchDto,
  ) {
    return this.increments.create(user, dto);
  }

  @Get('increments/:id/preview')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS)
  previewIncrement(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.increments.preview(user, id);
  }

  @Post('increments/:id/apply')
  @RequirePermissions('payroll:manage')
  applyIncrement(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.increments.apply(user, id);
  }

  // Loans
  @Get('loans')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS)
  listLoans(
    @CurrentUser() user: JwtUser,
    @Query('staffProfileId') staffProfileId?: string,
    @Query('status') status?: string,
  ) {
    return this.loans.list(user.tid, staffProfileId, status);
  }

  @Post('loans')
  @RequirePermissions('payroll:manage')
  createLoan(@CurrentUser() user: JwtUser, @Body() dto: CreateStaffLoanDto) {
    return this.loans.create(user, dto);
  }

  @Get('loans/:id/schedule')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS)
  loanSchedule(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.loans.getSchedule(user.tid, id);
  }

  // Payroll runs
  @Get('runs')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS, 'payroll:process')
  listRuns(@CurrentUser() user: JwtUser, @Query() query: PayrollQueryDto) {
    return this.runs.list(user.tid, query);
  }

  @Post('runs')
  @RequirePermissions('payroll:process')
  createRun(@CurrentUser() user: JwtUser, @Body() dto: CreatePayrollRunDto) {
    return this.runs.create(user, dto);
  }

  @Get('runs/:id')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS, 'payroll:process')
  getRun(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.runs.getRun(user.tid, id);
  }

  @Post('runs/:id/calculate')
  @RequirePermissions('payroll:process')
  calculateRun(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.runs.calculate(user, id);
  }

  @Post('runs/:id/verify')
  @RequirePermissions('payroll:verify')
  verifyRun(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.approval.transition(user, id, 'verify');
  }

  @Post('runs/:id/approve')
  @RequirePermissions('payroll:approve')
  approveRun(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.approval.transition(user, id, 'approve');
  }

  @Post('runs/:id/publish')
  @RequirePermissions('payroll:publish')
  publishRun(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.approval.transition(user, id, 'publish');
  }

  @Post('runs/:id/reopen')
  @RequirePermissions('payroll:process')
  reopenRun(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.approval.reopen(user, id);
  }

  @Post('runs/:id/mark-paid')
  @RequirePermissions('payroll:publish')
  markRunPaid(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.approval.markPaid(user, id);
  }

  @Post('runs/:id/email-payslips')
  @RequirePermissions('payroll:publish')
  emailRunPayslips(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.payslipNotify.emailRunPayslips(user, id);
  }

  @Get('runs/:id/exclusions')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS, 'payroll:process')
  listExclusions(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.payrollAdjustments.listExclusions(user.tid, id);
  }

  @Post('runs/:id/exclusions')
  @RequirePermissions('payroll:process')
  excludeStaff(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ExcludeStaffFromRunDto,
  ) {
    return this.payrollAdjustments.excludeStaff(
      user,
      id,
      dto.staffProfileId,
      dto.reason,
    );
  }

  @Delete('runs/:runId/exclusions/:staffProfileId')
  @RequirePermissions('payroll:process')
  includeStaff(
    @CurrentUser() user: JwtUser,
    @Param('runId') runId: string,
    @Param('staffProfileId') staffProfileId: string,
  ) {
    return this.payrollAdjustments.includeStaff(user, runId, staffProfileId);
  }

  @Get('runs/:id/adjustments')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS, 'payroll:process')
  listAdjustments(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.payrollAdjustments.listAdjustments(user.tid, id);
  }

  @Post('runs/:id/adjustments')
  @RequirePermissions('payroll:process')
  addAdjustment(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: CreatePayslipAdjustmentDto,
  ) {
    return this.payrollAdjustments.addAdjustment(user, id, dto);
  }

  @Delete('adjustments/:adjustmentId')
  @RequirePermissions('payroll:process')
  removeAdjustment(
    @CurrentUser() user: JwtUser,
    @Param('adjustmentId') adjustmentId: string,
  ) {
    return this.payrollAdjustments.removeAdjustment(user, adjustmentId);
  }

  @Get('audit-logs')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS)
  auditLogs(
    @CurrentUser() user: JwtUser,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
  ) {
    return this.payrollAudit.list(user.tid, { entityType, entityId });
  }

  // Payslips
  @Get('payslips/employee/:staffProfileId/history')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS)
  employeePayslipHistory(
    @CurrentUser() user: JwtUser,
    @Param('staffProfileId') staffProfileId: string,
  ) {
    return this.payslips.employeeHistory(user.tid, staffProfileId);
  }

  @Get('payslips/employee/:staffProfileId/merged-pdf')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS)
  async employeeMergedPdf(
    @CurrentUser() user: JwtUser,
    @Param('staffProfileId') staffProfileId: string,
    @Query() query: PayrollQueryDto,
    @Res() res: Response,
  ) {
    const buf = await this.payslips.mergedPdfBuffer(user.tid, {
      ...query,
      staffProfileId,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="payslips-${staffProfileId}.pdf"`,
    );
    return res.send(buf);
  }

  @Get('payslips/employee/:staffProfileId/salary-certificate')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS)
  async employeeSalaryCertificate(
    @CurrentUser() user: JwtUser,
    @Param('staffProfileId') staffProfileId: string,
    @Query('financialYear') financialYear: string | undefined,
    @Res() res: Response,
  ) {
    const buf = await this.payslips.salaryCertificateBuffer(
      user.tid,
      staffProfileId,
      financialYear ? Number(financialYear) : undefined,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="salary-certificate-${staffProfileId}.pdf"`,
    );
    return res.send(buf);
  }

  @Get('payslips/merged-pdf')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS)
  async mergedPayslipsPdf(
    @CurrentUser() user: JwtUser,
    @Query() query: PayrollQueryDto,
    @Res() res: Response,
  ) {
    const buf = await this.payslips.mergedPdfBuffer(user.tid, query);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="payslips-merged.pdf"',
    );
    return res.send(buf);
  }

  @Get('payslips/stats')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS)
  payslipStats(@CurrentUser() user: JwtUser, @Query() query: PayrollQueryDto) {
    return this.payslips.stats(user.tid, query);
  }

  @Get('payslips/analytics')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS)
  payslipAnalytics(
    @CurrentUser() user: JwtUser,
    @Query() query: PayrollQueryDto,
  ) {
    return this.payslips.analytics(user.tid, query);
  }

  @Get('payslips')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS)
  listPayslips(@CurrentUser() user: JwtUser, @Query() query: PayrollQueryDto) {
    return this.payslips.list(user.tid, query);
  }

  @Post('payslips/regenerate')
  @RequirePermissions('payroll:process')
  regeneratePayslips(
    @CurrentUser() user: JwtUser,
    @Query() query: PayrollQueryDto,
  ) {
    return this.payslips.regenerateBulk(user.tid, query);
  }

  @Get('payslips/download-zip')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS)
  async payslipsZip(
    @CurrentUser() user: JwtUser,
    @Query() query: PayrollQueryDto,
    @Res() res: Response,
  ) {
    const buf = await this.payslips.downloadZip(user.tid, query);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="payslips.zip"');
    return res.send(buf);
  }

  @Post('payslips/:id/regenerate')
  @RequirePermissions('payroll:process')
  regeneratePayslip(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.payslips.regenerate(user.tid, id);
  }

  @Post('payslips/:id/email')
  @RequirePermissions('payroll:process')
  emailPayslip(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.payslipNotify.emailOnePayslip(user, id);
  }

  @Get('payslips/:id/pdf')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS)
  async payslipPdf(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const buffer = await this.payslipDocs.readPdfBuffer(user.tid, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="payslip-${id}.pdf"`,
    );
    return res.send(buffer);
  }

  // PF/CPF
  @Get('pf-cpf')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS)
  listPfCpf(
    @CurrentUser() user: JwtUser,
    @Query() query: PayrollQueryDto & { type?: string },
  ) {
    return this.pfCpf.list(user.tid, {
      staffProfileId: query.staffProfileId,
      month: query.month,
      year: query.year,
      type: query.type,
    });
  }

  // Arrears
  @Get('arrears')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS)
  listArrears(@CurrentUser() user: JwtUser) {
    return this.arrears.list(user.tid);
  }

  @Post('arrears')
  @RequirePermissions('payroll:manage')
  createArrears(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateArrearBatchDto,
  ) {
    return this.arrears.create(user, dto);
  }

  @Post('arrears/:id/apply/:runId')
  @RequirePermissions('payroll:process')
  applyArrearToRun(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('runId') runId: string,
  ) {
    return this.arrears.applyToRun(user, id, runId);
  }

  // Reports
  @Get('reports/salary-register')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS)
  async salaryRegister(
    @CurrentUser() user: JwtUser,
    @Query('runId') runId: string,
    @Res() res: Response,
  ) {
    const buf = await this.reports.salaryRegisterBuffer(user.tid, runId);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="salary-register.xlsx"`,
    );
    return res.send(buf);
  }

  @Get('reports/bulk-sheet')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS)
  async bulkSheet(
    @CurrentUser() user: JwtUser,
    @Query('runId') runId: string,
    @Query('payScaleType') payScaleType: string,
    @Query('layoutKey') layoutKey: string | undefined,
    @Res() res: Response,
  ) {
    const layout = layoutKey ?? payScaleType;
    const buf = await this.reports.bulkSalarySheetBuffer(
      user.tid,
      runId,
      payScaleType,
      layoutKey,
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${layout}-salary.xlsx"`,
    );
    return res.send(buf);
  }

  @Get('reports/department-wise')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS)
  departmentWise(
    @CurrentUser() user: JwtUser,
    @Query('month') month: number,
    @Query('year') year: number,
  ) {
    return this.reports.departmentWise(user.tid, Number(month), Number(year));
  }

  @Post('import/excel-templates')
  @RequirePermissions('payroll:manage')
  importLayouts(
    @CurrentUser() user: JwtUser,
    @Body() body: { layouts: Record<string, string[]> },
  ) {
    return this.reports.importExcelLayouts(user.tid, body.layouts);
  }

  @Get('reports/bank-file')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS)
  bankFile(@CurrentUser() user: JwtUser, @Query('runId') runId?: string) {
    if (!runId) {
      return this.reports.bankFileScaffold(user.tid, 'SBI');
    }
    return this.reports.bankTransferData(user.tid, runId);
  }

  @Get('reports/bank-file/export')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS)
  async bankFileExport(
    @CurrentUser() user: JwtUser,
    @Query('runId') runId: string,
    @Query('format') format: string,
    @Res() res: Response,
  ) {
    if (format === 'csv') {
      const data = await this.reports.bankTransferData(user.tid, runId);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="bank-transfer.csv"`,
      );
      return res.send(this.reports.bankFileCsv(data));
    }
    const buf = await this.reports.bankFileExcelBuffer(user.tid, runId);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="bank-transfer.xlsx"`,
    );
    return res.send(buf);
  }

  @Get('pf-config/staff/:staffProfileId')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS)
  getStaffPfConfig(
    @CurrentUser() user: JwtUser,
    @Param('staffProfileId') staffProfileId: string,
  ) {
    return this.staffPfConfig.getForStaff(user.tid, staffProfileId);
  }

  @Get('pf-config/staff/:staffProfileId/history')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS)
  getStaffPfHistory(
    @CurrentUser() user: JwtUser,
    @Param('staffProfileId') staffProfileId: string,
  ) {
    return this.staffPfConfig.getHistory(user.tid, staffProfileId);
  }

  @Post('pf-config/staff/:staffProfileId')
  @RequirePermissions('payroll:manage')
  upsertStaffPfConfig(
    @CurrentUser() user: JwtUser,
    @Param('staffProfileId') staffProfileId: string,
    @Body() dto: UpsertStaffPfConfigDto,
  ) {
    return this.staffPfConfig.upsert(user, staffProfileId, dto);
  }

  @Post('pf-config/bulk')
  @RequirePermissions('payroll:manage')
  bulkStaffPfConfig(
    @CurrentUser() user: JwtUser,
    @Body() dto: BulkStaffPfConfigDto,
  ) {
    return this.staffPfConfig.bulkUpdate(user, dto);
  }

  @Get('pf-config/reports/enrolled')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS)
  pfEnrolledReport(
    @CurrentUser() user: JwtUser,
    @Query('departmentId') departmentId?: string,
    @Query('payScaleType') payScaleType?: string,
  ) {
    return this.staffPfConfig.reportEnrolled(user.tid, {
      departmentId,
      payScaleType,
    });
  }

  @Get('pf-config/reports/exempt')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS)
  pfExemptReport(
    @CurrentUser() user: JwtUser,
    @Query('departmentId') departmentId?: string,
    @Query('payScaleType') payScaleType?: string,
  ) {
    return this.staffPfConfig.reportExempt(user.tid, {
      departmentId,
      payScaleType,
    });
  }

  @Get('pf-config/reports/monthly')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS)
  pfMonthlyReport(
    @CurrentUser() user: JwtUser,
    @Query('month') month: number,
    @Query('year') year: number,
  ) {
    return this.staffPfConfig.reportMonthlyContribution(
      user.tid,
      Number(month),
      Number(year),
    );
  }

  @Get('pf-config/reports/by-department')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS)
  pfByDepartment(
    @CurrentUser() user: JwtUser,
    @Query('month') month: number,
    @Query('year') year: number,
  ) {
    return this.staffPfConfig.reportByDepartment(
      user.tid,
      Number(month),
      Number(year),
    );
  }

  @Get('pf-config/reports/by-pay-structure')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS)
  pfByPayStructure(
    @CurrentUser() user: JwtUser,
    @Query('month') month: number,
    @Query('year') year: number,
  ) {
    return this.staffPfConfig.reportByPayStructure(
      user.tid,
      Number(month),
      Number(year),
    );
  }

  @Get('pf-config/reports/register')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS)
  pfRegister(
    @CurrentUser() user: JwtUser,
    @Query('month') month: number,
    @Query('year') year: number,
  ) {
    return this.staffPfConfig.reportPfRegister(
      user.tid,
      Number(month),
      Number(year),
    );
  }
}
