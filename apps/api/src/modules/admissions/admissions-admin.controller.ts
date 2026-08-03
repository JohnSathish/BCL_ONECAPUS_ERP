import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
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
import { AdmissionsAnalyticsService } from './admissions-analytics.service';
import { AdmissionsCycleService } from './admissions-cycle.service';
import type { CycleSettings } from './admissions-cycle.service';
import { AdmissionsDocumentService } from './admissions-document.service';
import { AdmissionsEnrollmentService } from './admissions-enrollment.service';
import { AdmissionsMeritService } from './admissions-merit.service';
import { AdmissionsApplicationDocumentService } from './admissions-application-document.service';
import { AdmissionsAllocationService } from './admissions-allocation.service';
import { AdmissionsService } from './admissions.service';
import {
  CloneAdmissionCycleDto,
  ClonePreviewQueryDto,
  GenerateMeritListDto,
  MarkAdmissionFeeDto,
  MarkPaymentDto,
  RunSeatAllocationDto,
  UpdateCycleDto,
  UpsertIntakeShiftDto,
  VerifyDocumentDto,
} from './dto/admissions.dto';

@ApiBearerAuth()
@ApiTags('admissions-admin')
@Controller({ path: 'admissions/admin', version: '1' })
export class AdmissionsAdminController {
  constructor(
    private readonly cycles: AdmissionsCycleService,
    private readonly admissions: AdmissionsService,
    private readonly merit: AdmissionsMeritService,
    private readonly allocation: AdmissionsAllocationService,
    private readonly documents: AdmissionsDocumentService,
    private readonly enrollment: AdmissionsEnrollmentService,
    private readonly analytics: AdmissionsAnalyticsService,
    private readonly applicationDocuments: AdmissionsApplicationDocumentService,
  ) {}

  @Get('cycles')
  @RequireAnyPermission(
    'admissions:read',
    'admissions:manage',
    'admissions:configure',
  )
  listCycles(@CurrentUser() user: JwtUser, @Query('status') status?: string) {
    return this.cycles.listCycles(user.tid, status);
  }

  @Get('cycles/clone-preview')
  @RequireAnyPermission('admissions:manage', 'admissions:configure')
  clonePreview(
    @CurrentUser() user: JwtUser,
    @Query() query: ClonePreviewQueryDto,
  ) {
    return this.cycles.previewClone(
      user.tid,
      query.sourceCycleId,
      query.academicYearName,
    );
  }

  @Post('cycles/clone')
  @RequirePermissions('admissions:manage')
  cloneCycle(
    @CurrentUser() user: JwtUser,
    @Body() dto: CloneAdmissionCycleDto,
  ) {
    return this.cycles.cloneAdmissionCycle(user.tid, user.sub, {
      sourceCycleId: dto.sourceCycleId,
      academicYearId: dto.academicYearId,
      createAcademicYear: dto.createAcademicYear,
      applicationNumberPrefix: dto.applicationNumberPrefix,
      deadlineMode: dto.deadlineMode ?? 'clear',
      archiveSource: dto.archiveSource ?? false,
      title: dto.title,
      registrationOpensAt: dto.registrationOpensAt
        ? new Date(dto.registrationOpensAt)
        : dto.registrationOpensAt === null
          ? null
          : undefined,
      registrationClosesAt: dto.registrationClosesAt
        ? new Date(dto.registrationClosesAt)
        : dto.registrationClosesAt === null
          ? null
          : undefined,
      applicationDeadline: dto.applicationDeadline
        ? new Date(dto.applicationDeadline)
        : dto.applicationDeadline === null
          ? null
          : undefined,
      paymentDeadline: dto.paymentDeadline
        ? new Date(dto.paymentDeadline)
        : dto.paymentDeadline === null
          ? null
          : undefined,
      settingsOverrides: dto.settingsOverrides as CycleSettings | undefined,
    });
  }

  @Get('cycles/:id')
  @RequireAnyPermission(
    'admissions:read',
    'admissions:manage',
    'admissions:configure',
  )
  getCycle(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.cycles.getCycle(user.tid, id);
  }

  @Patch('cycles/:id')
  @RequirePermissions('admissions:configure')
  updateCycle(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateCycleDto,
  ) {
    return this.cycles.updateCycle(
      user.tid,
      id,
      {
        title: dto.title,
        registrationOpensAt: dto.registrationOpensAt
          ? new Date(dto.registrationOpensAt)
          : undefined,
        registrationClosesAt: dto.registrationClosesAt
          ? new Date(dto.registrationClosesAt)
          : undefined,
        applicationDeadline: dto.applicationDeadline
          ? new Date(dto.applicationDeadline)
          : undefined,
        paymentDeadline: dto.paymentDeadline
          ? new Date(dto.paymentDeadline)
          : undefined,
        settings: dto.settings as CycleSettings | undefined,
      },
      user.sub,
    );
  }

  @Post('cycles/:id/publish')
  @RequirePermissions('admissions:configure')
  publishCycle(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.cycles.publishCycle(user.tid, id, user.sub);
  }

  @Post('cycles/:id/close')
  @RequirePermissions('admissions:configure')
  closeCycle(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.cycles.closeCycle(user.tid, id, user.sub);
  }

  @Post('cycles/:id/archive')
  @RequirePermissions('admissions:manage')
  archiveCycle(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.cycles.archiveCycle(user.tid, id, user.sub);
  }

  @Put('cycles/:cycleId/programs/:programId')
  @RequirePermissions('admissions:configure')
  upsertProgram(
    @CurrentUser() user: JwtUser,
    @Param('cycleId') cycleId: string,
    @Param('programId') programId: string,
    @Body('enabled') enabled: boolean,
  ) {
    return this.cycles.upsertCycleProgram(
      user.tid,
      cycleId,
      programId,
      enabled ?? true,
    );
  }

  @Put('intakes/:intakeId/shifts')
  @RequirePermissions('admissions:configure')
  upsertShift(
    @CurrentUser() user: JwtUser,
    @Param('intakeId') intakeId: string,
    @Body() dto: UpsertIntakeShiftDto,
  ) {
    return this.cycles.upsertIntakeShift(
      user.tid,
      intakeId,
      dto.shiftId,
      dto.totalSeats,
      dto.reservedSeats,
    );
  }

  @Get('applications/:id/documents')
  @RequireAnyPermission('admissions:read', 'admissions:verify-documents')
  listDocuments(
    @CurrentUser() user: JwtUser,
    @Param('id') applicationId: string,
  ) {
    return this.documents.listForApplication(user.tid, applicationId);
  }

  @Patch('documents/:id/verify')
  @RequirePermissions('admissions:verify-documents')
  verifyDocument(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: VerifyDocumentDto,
  ) {
    return this.documents.verifyDocument(
      user.tid,
      id,
      user.sub,
      dto.status,
      dto.remarks,
    );
  }

  @Patch('applications/:id/payment')
  @RequirePermissions('admissions:manage')
  markPayment(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: MarkPaymentDto,
  ) {
    return this.admissions.markPayment(user.tid, id, dto, user.sub);
  }

  @Patch('applications/:id/admission-fee')
  @RequirePermissions('admissions:manage')
  markAdmissionFee(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: MarkAdmissionFeeDto,
  ) {
    return this.admissions.markAdmissionFee(user.tid, id, dto, user.sub);
  }

  @Post('applications/:id/send-offer')
  @RequirePermissions('admissions:manage')
  sendOffer(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.admissions.sendAdmissionOffer(user.tid, id);
  }

  @Get('applications/:id/pdf')
  @RequireAnyPermission('admissions:read', 'admissions:manage')
  async exportApplicationPdf(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.applicationDocuments.exportPdf(
      user.tid,
      id,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Post('merit-lists/generate')
  @RequirePermissions('admissions:publish-merit')
  generateMerit(
    @CurrentUser() user: JwtUser,
    @Body() dto: GenerateMeritListDto,
  ) {
    return this.merit.generateMeritList(user.tid, dto, user.sub);
  }

  @Post('merit-lists/:id/publish')
  @RequirePermissions('admissions:publish-merit')
  publishMerit(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.merit.publishMeritList(user.tid, id, user.sub);
  }

  @Post('allocations/run')
  @RequirePermissions('admissions:allocate')
  runAllocation(
    @CurrentUser() user: JwtUser,
    @Body() dto: RunSeatAllocationDto,
  ) {
    return this.allocation.runSeatAllocation(user.tid, dto, user.sub);
  }

  @Post('applications/:id/enroll')
  @RequirePermissions('admissions:enroll')
  enroll(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body()
    dto: {
      programVersionId?: string;
      admissionBatchId?: string;
      primaryShiftId?: string;
    },
  ) {
    return this.enrollment.enrollFromApplication(user, id, dto);
  }

  @Get('analytics/funnel')
  @RequireAnyPermission('admissions:read', 'admissions:manage')
  funnel(@CurrentUser() user: JwtUser, @Query('cycleId') cycleId?: string) {
    return this.analytics.getFunnel(user.tid, cycleId);
  }

  @Get('analytics/programs')
  @RequireAnyPermission('admissions:read', 'admissions:manage')
  programBreakdown(
    @CurrentUser() user: JwtUser,
    @Query('cycleId') cycleId?: string,
  ) {
    return this.analytics.getProgramBreakdown(user.tid, cycleId);
  }

  @Get('analytics/shift-fill')
  @RequireAnyPermission('admissions:read', 'admissions:manage')
  shiftFill(@CurrentUser() user: JwtUser, @Query('cycleId') cycleId: string) {
    return this.analytics.getShiftFillRate(user.tid, cycleId);
  }

  @Get('analytics/daily')
  @RequireAnyPermission('admissions:read', 'admissions:manage')
  daily(
    @CurrentUser() user: JwtUser,
    @Query('cycleId') cycleId: string,
    @Query('days') days?: number,
  ) {
    return this.analytics.getDailyRegistrations(user.tid, cycleId, days ?? 30);
  }

  @Get('cycles/:cycleId/export')
  @RequireAnyPermission('admissions:read', 'admissions:manage')
  async exportCsv(
    @CurrentUser() user: JwtUser,
    @Param('cycleId') cycleId: string,
    @Res() res: Response,
  ) {
    const csv = await this.analytics.exportApplicationsCsv(user.tid, cycleId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="admissions-${cycleId}.csv"`,
    );
    res.send(csv);
  }

  @Get('audit/:entityType/:entityId')
  @RequireAnyPermission('admissions:read', 'admissions:manage')
  auditLog(
    @CurrentUser() user: JwtUser,
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.admissions.getAuditLog(user.tid, entityType, entityId);
  }
}
