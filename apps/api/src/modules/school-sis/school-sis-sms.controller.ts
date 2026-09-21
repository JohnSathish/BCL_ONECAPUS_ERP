import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import { extractClientIp } from '../../common/utils/request-host';
import { RequiresSchoolLicense } from './school-sis-license.decorators';
import {
  SIS_SMS_BULK,
  SIS_SMS_DLT,
  SIS_SMS_GATEWAY,
  SIS_SMS_REPORTS,
  SIS_SMS_SEND,
  SIS_SMS_SETTINGS,
  SIS_SMS_TEMPLATES,
  SIS_SMS_VIEW,
} from './school-sis-sms.perms';
import { SchoolSisSmsService } from './school-sis-sms.service';

@ApiBearerAuth()
@ApiTags('school-sis-sms')
@RequiresSchoolLicense('sms')
@Controller({ path: 'school-sis/sms', version: '1' })
export class SchoolSisSmsController {
  constructor(private readonly sms: SchoolSisSmsService) {}

  @Get('dashboard')
  @RequireAnyPermission(...SIS_SMS_VIEW)
  dash(@CurrentUser() user: JwtUser) {
    return this.sms.dashboard(user.tid);
  }

  @Post('preview')
  @RequireAnyPermission(...SIS_SMS_VIEW)
  preview(
    @CurrentUser() user: JwtUser,
    @Body() body: { template?: string; variables?: Record<string, string> },
  ) {
    return this.sms.preview(user.tid, body);
  }

  @Get('configuration')
  @RequireAnyPermission(...SIS_SMS_VIEW, ...SIS_SMS_GATEWAY)
  configuration(@CurrentUser() user: JwtUser) {
    return this.sms.configStatus(user.tid);
  }

  @Get('students')
  @RequireAnyPermission(...SIS_SMS_SEND)
  searchStudents(
    @CurrentUser() user: JwtUser,
    @Query('q') q?: string,
    @Query('recipient') recipient?: string,
  ) {
    return this.sms.searchStudents(user.tid, q || '', recipient || 'PARENT');
  }

  @Post('recipients')
  @RequireAnyPermission(...SIS_SMS_SEND)
  recipients(
    @CurrentUser() user: JwtUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.sms
      .resolve(user.tid, body as never, String(body.category || 'GENERAL'))
      .then(({ recipients: _r, ...rest }) => rest);
  }

  @Post('campaigns')
  @RequireAnyPermission(...SIS_SMS_BULK, ...SIS_SMS_SEND)
  send(
    @CurrentUser() user: JwtUser,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.sms.sendCampaign(
      user.tid,
      {
        name: body.name as string,
        category: body.category as string,
        smsKind: body.smsKind as string,
        audience: (body.audience ?? {}) as never,
        templateKey: body.templateKey as string,
        body: body.body as string,
        variables: body.variables as Record<string, string>,
        gatewayId: body.gatewayId as string,
        scheduleAt: body.scheduleAt as string,
        sendNow: body.sendNow !== false && !body.scheduleAt,
        idempotencyKey: body.idempotencyKey as string,
      },
      user.sub,
      extractClientIp(req),
    );
  }

  @Get('campaigns')
  @RequireAnyPermission(...SIS_SMS_VIEW)
  campaigns(@CurrentUser() user: JwtUser) {
    return this.sms.campaigns(user.tid);
  }

  @Post('campaigns/:id/cancel')
  @RequireAnyPermission(...SIS_SMS_BULK)
  cancel(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.sms.cancelCampaign(user.tid, id);
  }

  @Get('messages')
  @RequireAnyPermission(...SIS_SMS_VIEW, ...SIS_SMS_REPORTS)
  messages(
    @CurrentUser() user: JwtUser,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.sms.messages(user.tid, { status, search });
  }

  @Post('messages/:id/retry')
  @RequireAnyPermission(...SIS_SMS_SEND)
  retry(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.sms.retry(user.tid, id);
  }

  @Get('templates')
  @RequireAnyPermission(...SIS_SMS_TEMPLATES, ...SIS_SMS_VIEW)
  templates(@CurrentUser() user: JwtUser) {
    return this.sms.templates(user.tid);
  }

  @Post('templates')
  @RequireAnyPermission(...SIS_SMS_TEMPLATES)
  saveTpl(@CurrentUser() user: JwtUser, @Body() body: Record<string, unknown>) {
    return this.sms.saveTemplate(user.tid, body);
  }

  @Patch('templates/:id')
  @RequireAnyPermission(...SIS_SMS_TEMPLATES)
  editTpl(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.sms.saveTemplate(user.tid, body, id);
  }

  @Get('gateways')
  @RequireAnyPermission(...SIS_SMS_GATEWAY)
  gateways(@CurrentUser() user: JwtUser) {
    return this.sms.gateways(user.tid);
  }

  @Post('gateways')
  @RequireAnyPermission(...SIS_SMS_GATEWAY)
  saveGw(@CurrentUser() user: JwtUser, @Body() body: Record<string, unknown>) {
    return this.sms.saveGateway(user.tid, body);
  }

  @Patch('gateways/:id')
  @RequireAnyPermission(...SIS_SMS_GATEWAY)
  editGw(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.sms.saveGateway(user.tid, body, id);
  }

  @Post('gateways/:id/test')
  @RequireAnyPermission(...SIS_SMS_GATEWAY, ...SIS_SMS_SEND)
  testGw(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { mobile?: string },
  ) {
    return this.sms.testGateway(user.tid, id, body?.mobile);
  }

  @Post('gateways/:id/set-default')
  @RequireAnyPermission(...SIS_SMS_GATEWAY)
  defGw(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.sms.setDefaultGateway(user.tid, id);
  }

  @Get('dlt')
  @RequireAnyPermission(...SIS_SMS_DLT, ...SIS_SMS_VIEW)
  dlt(@CurrentUser() user: JwtUser) {
    return this.sms.dlt(user.tid);
  }

  @Post('dlt/headers')
  @RequireAnyPermission(...SIS_SMS_DLT)
  header(@CurrentUser() user: JwtUser, @Body() body: Record<string, unknown>) {
    return this.sms.saveHeader(user.tid, body);
  }

  @Post('dlt/templates')
  @RequireAnyPermission(...SIS_SMS_DLT)
  dltTpl(@CurrentUser() user: JwtUser, @Body() body: Record<string, unknown>) {
    return this.sms.saveDltTemplate(user.tid, body);
  }

  @Get('settings')
  @RequireAnyPermission(...SIS_SMS_SETTINGS, ...SIS_SMS_VIEW)
  settings(@CurrentUser() user: JwtUser) {
    return this.sms.settingsView(user.tid);
  }

  @Patch('settings')
  @RequireAnyPermission(...SIS_SMS_SETTINGS)
  saveSettings(
    @CurrentUser() user: JwtUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.sms.saveSettings(user.tid, body);
  }

  @Post('credits')
  @RequireAnyPermission(...SIS_SMS_SETTINGS)
  credits(
    @CurrentUser() user: JwtUser,
    @Body() body: { amount: number; note?: string },
  ) {
    return this.sms.credits(
      user.tid,
      Number(body.amount || 0),
      body.note || 'Adjustment',
      user.sub,
    );
  }

  @Post('otp')
  @RequireAnyPermission(...SIS_SMS_SEND)
  otp(
    @CurrentUser() user: JwtUser,
    @Body() body: { mobile: string; purpose?: string },
  ) {
    return this.sms.issueOtp(user.tid, body.mobile, body.purpose || 'LOGIN');
  }

  @Post('otp/verify')
  @RequireAnyPermission(...SIS_SMS_SEND, ...SIS_SMS_VIEW)
  verify(
    @CurrentUser() user: JwtUser,
    @Body() body: { mobile: string; purpose?: string; code: string },
  ) {
    return this.sms.verifyOtp(
      user.tid,
      body.mobile,
      body.purpose || 'LOGIN',
      body.code,
    );
  }

  @Get('audit')
  @RequireAnyPermission(...SIS_SMS_SETTINGS)
  audit(@CurrentUser() user: JwtUser) {
    return this.sms.auditLog(user.tid);
  }

  @Get('export')
  @RequireAnyPermission(...SIS_SMS_REPORTS)
  async export(
    @CurrentUser() user: JwtUser,
    @Query('format') format: 'pdf' | 'xlsx' | 'csv' = 'pdf',
    @Res() res: Response,
  ) {
    const out = await this.sms.exportReport(user.tid, format);
    res.setHeader('Content-Type', out.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${out.filename}"`,
    );
    return res.send(out.buffer);
  }
}
