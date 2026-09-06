import {
  Body,
  Controller,
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
import { SchoolAdmissionsDocumentService } from './school-admissions-document.service';
import { SchoolAdmissionsFormService } from './school-admissions-form.service';
import { SchoolAdmissionsOfficeService } from './school-admissions-office.service';
import { SchoolAdmissionsPdfService } from './school-admissions-pdf.service';
import {
  SchoolAdmissionWindowUpdateDto,
  SchoolDecisionDto,
  SchoolDocumentRequirementsUpdateDto,
  SchoolOfficeListQueryDto,
  SchoolRejectDocumentDto,
  SchoolRejectPaymentDto,
  SchoolVerifyDocumentDto,
  SchoolVerifyPaymentDto,
} from './dto/school-admissions.dto';

@ApiBearerAuth()
@ApiTags('school-admissions-office')
@Controller({ path: 'school-admissions/office', version: '1' })
export class SchoolAdmissionsOfficeController {
  constructor(
    private readonly office: SchoolAdmissionsOfficeService,
    private readonly pdf: SchoolAdmissionsPdfService,
    private readonly form: SchoolAdmissionsFormService,
    private readonly documents: SchoolAdmissionsDocumentService,
  ) {}

  @Get('summary')
  @RequireAnyPermission('admissions:read', 'admissions:manage')
  summary(@CurrentUser() user: JwtUser) {
    return this.office.summary(user.tid);
  }

  @Get('settings')
  @RequireAnyPermission(
    'admissions:read',
    'admissions:manage',
    'admissions:configure',
  )
  settings(@CurrentUser() user: JwtUser) {
    return this.office.getCycleSettings(user.tid);
  }

  @Patch('settings/document-requirements')
  @RequireAnyPermission('admissions:manage', 'admissions:configure')
  updateDocumentRequirements(
    @CurrentUser() user: JwtUser,
    @Body() dto: SchoolDocumentRequirementsUpdateDto,
  ) {
    return this.office.updateDocumentRequirements(
      user.tid,
      user.sub,
      dto.documentRequirements,
    );
  }

  @Get('settings/admission-window')
  @RequireAnyPermission(
    'admissions:read',
    'admissions:manage',
    'admissions:configure',
  )
  admissionWindow(@CurrentUser() user: JwtUser) {
    return this.office.getAdmissionWindow(user.tid);
  }

  @Patch('settings/admission-window')
  @RequireAnyPermission('admissions:manage', 'admissions:configure')
  updateAdmissionWindow(
    @CurrentUser() user: JwtUser,
    @Body() dto: SchoolAdmissionWindowUpdateDto,
  ) {
    return this.office.updateAdmissionWindow(user.tid, user.sub, dto);
  }

  @Get('applications')
  @RequireAnyPermission('admissions:read', 'admissions:manage')
  list(@CurrentUser() user: JwtUser, @Query() query: SchoolOfficeListQueryDto) {
    return this.office.list(user.tid, query);
  }

  @Get('applications/export')
  @RequireAnyPermission('admissions:read', 'admissions:manage')
  async export(
    @CurrentUser() user: JwtUser,
    @Query() query: SchoolOfficeListQueryDto,
    @Res() res: Response,
  ) {
    const report = await this.office.exportExcelReport(user.tid, query);
    res.setHeader('Content-Type', report.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${report.filename}"`,
    );
    res.send(report.buffer);
  }

  @Get('applications/:id')
  @RequireAnyPermission('admissions:read', 'admissions:manage')
  get(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.office.get(user.tid, id);
  }

  @Get('applications/:id/pdf')
  @RequireAnyPermission('admissions:read', 'admissions:manage')
  async downloadPdf(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const file = await this.pdf.getStoredPdfForOffice(user.tid, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    res.send(file.buffer);
  }

  @Get('applications/:id/documents/:slotCode/file')
  @RequireAnyPermission(
    'admissions:read',
    'admissions:manage',
    'admissions:verify-documents',
  )
  async downloadDocument(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('slotCode') slotCode: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.documents.streamOfficeDocument(
      user.tid,
      id,
      slotCode,
    );
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
    return file.stream;
  }

  @Post('applications/:id/reset-login-pin')
  @RequireAnyPermission('admissions:manage', 'admissions:configure')
  resetLoginPin(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.office.resetApplicantLoginPin(user.tid, id, user.sub);
  }

  @Post('applications/:id/resend-pdf-email')
  @RequireAnyPermission('admissions:manage', 'admissions:configure')
  resendPdfEmail(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.form.resendSubmissionEmail(user.tid, id, user.sub);
  }

  @Post('applications/:id/verify-payment')
  @RequireAnyPermission('admissions:manage', 'admissions:verify-documents')
  verifyPayment(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SchoolVerifyPaymentDto,
  ) {
    return this.office.verifyPayment(user.tid, id, user.sub, dto);
  }

  @Post('applications/:id/reject-payment')
  @RequireAnyPermission('admissions:manage', 'admissions:verify-documents')
  rejectPayment(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SchoolRejectPaymentDto,
  ) {
    return this.office.rejectPayment(user.tid, id, user.sub, dto.remarks);
  }

  @Post('applications/:id/documents/:slotCode/verify')
  @RequireAnyPermission('admissions:manage', 'admissions:verify-documents')
  verifyDocument(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('slotCode') slotCode: string,
    @Body() dto: SchoolVerifyDocumentDto,
  ) {
    return this.office.verifyDocument(user.tid, id, slotCode, user.sub, dto);
  }

  @Post('applications/:id/documents/:slotCode/reject')
  @RequireAnyPermission('admissions:manage', 'admissions:verify-documents')
  rejectDocument(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('slotCode') slotCode: string,
    @Body() dto: SchoolRejectDocumentDto,
  ) {
    return this.office.rejectDocument(
      user.tid,
      id,
      slotCode,
      user.sub,
      dto.remarks,
    );
  }

  @Post('applications/:id/decision')
  @RequireAnyPermission('admissions:manage', 'admissions:enroll')
  decide(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SchoolDecisionDto,
  ) {
    return this.office.decide(user.tid, id, user.sub, dto);
  }
}
