import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequiresSchoolLicense } from './school-sis-license.decorators';
import type { Request, Response } from 'express';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import { SCHOOL_SIS_PERMISSION_MANAGE } from './school-sis.constants';
import { SIS_FEES_COLLECT, SIS_FEES_VIEW } from './school-sis-iam.perms';
import {
  CollectSchoolFeeDto,
  CloseSchoolFeeCashDto,
  SaveSchoolFeeSettingsDto,
  SaveSchoolMonthlyFeePlanDto,
  SchoolOnlineCheckoutDto,
  SchoolOnlineVerifyDto,
  VoidSchoolFeeDto,
} from './dto/school-sis.dto';
import { extractClientIp } from '../../common/utils/request-host';
import { SchoolSisMonthlyFeesService } from './school-sis-monthly-fees.service';
import { SchoolSisPaymentGatewaysService } from './school-sis-payment-gateways.service';
import {
  SchoolSisFeeReportsService,
  type UserWiseSort,
} from './school-sis-fee-reports.service';
import { SchoolSisReportsService } from './school-sis-reports.service';

function reportActor(user: JwtUser) {
  const perms = user.permissions ?? [];
  const canClose =
    perms.includes(SCHOOL_SIS_PERMISSION_MANAGE) || perms.includes('*');
  const roleBlob = (user.roles ?? []).join(' ').toLowerCase();
  const canViewAll = canClose || /accountant|admin|principal/.test(roleBlob);
  return { userId: user.sub, canViewAll, canClose };
}

@ApiBearerAuth()
@ApiTags('school-sis-monthly-fees')
@RequiresSchoolLicense('fees')
@Controller({ path: 'school-sis/fees/monthly', version: '1' })
export class SchoolSisMonthlyFeesController {
  constructor(
    private readonly fees: SchoolSisMonthlyFeesService,
    private readonly reports: SchoolSisFeeReportsService,
    private readonly engineReports: SchoolSisReportsService,
    private readonly gateways: SchoolSisPaymentGatewaysService,
  ) {}

  @Get('config')
  @RequireAnyPermission(...SIS_FEES_VIEW)
  config(@CurrentUser() user: JwtUser) {
    return this.fees.getConfig(user.tid);
  }

  @Patch('config')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  saveConfig(
    @CurrentUser() user: JwtUser,
    @Body() dto: SaveSchoolFeeSettingsDto,
  ) {
    return this.fees.saveSettings(user.tid, dto, user.sub);
  }

  @Post('config/reset')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  resetConfig(@CurrentUser() user: JwtUser) {
    return this.fees.resetSettings(user.tid, user.sub);
  }

  @Put('plans')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  savePlan(
    @CurrentUser() user: JwtUser,
    @Body() dto: SaveSchoolMonthlyFeePlanDto,
  ) {
    return this.fees.savePlan(user.tid, dto);
  }

  @Get('quote')
  @RequireAnyPermission(...SIS_FEES_VIEW)
  quote(
    @CurrentUser() user: JwtUser,
    @Query('studentId') studentId: string,
    @Query('month') month: string,
  ) {
    return this.fees.quote(user.tid, studentId, month);
  }

  @Post('collect')
  @RequireAnyPermission(...SIS_FEES_COLLECT)
  async collect(
    @CurrentUser() user: JwtUser,
    @Body() dto: CollectSchoolFeeDto,
  ) {
    const actor = reportActor(user);
    await this.reports.assertCounterOpenForCollect(
      user.tid,
      user.sub,
      actor.canClose,
    );
    return this.fees.collect(user.tid, dto, user.sub);
  }

  @Post('online/checkout')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  onlineCheckout(
    @CurrentUser() user: JwtUser,
    @Body() dto: SchoolOnlineCheckoutDto,
  ) {
    return this.gateways.checkout(user.tid, dto, user.sub);
  }

  @Post('online/verify')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  onlineVerify(
    @CurrentUser() user: JwtUser,
    @Body() dto: SchoolOnlineVerifyDto,
  ) {
    return this.gateways.verifyCheckout(user.tid, dto, user.sub);
  }

  @Get('dashboard')
  @RequireAnyPermission(...SIS_FEES_VIEW)
  dashboard(@CurrentUser() user: JwtUser) {
    return this.fees.dashboard(user.tid);
  }

  @Get('register')
  @RequireAnyPermission(...SIS_FEES_VIEW)
  register(
    @CurrentUser() user: JwtUser,
    @Query('month') month?: string,
    @Query('gradeId') gradeId?: string,
    @Query('sectionId') sectionId?: string,
    @Query('status') status?: string,
    @Query('paymentMode') paymentMode?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') q?: string,
  ) {
    return this.fees.register(user.tid, {
      month,
      gradeId,
      sectionId,
      status,
      paymentMode,
      from,
      to,
      q,
    });
  }

  @Get('register-export')
  @RequireAnyPermission(...SIS_FEES_VIEW)
  async exportRegister(
    @CurrentUser() user: JwtUser,
    @Res() res: Response,
    @Req() req: Request,
    @Query('month') month?: string,
    @Query('gradeId') gradeId?: string,
    @Query('status') status?: string,
    @Query('format') format?: 'pdf' | 'xlsx' | 'html' | 'csv',
    @Query('orientation') orientation?: 'portrait' | 'landscape',
  ) {
    const file = await this.engineReports.export(user.tid, user, {
      key: 'fee_register',
      format: format || 'xlsx',
      orientation: orientation || 'landscape',
      filters: {
        month: month ?? '',
        gradeId: gradeId ?? '',
        status: status ?? '',
      },
      ip: extractClientIp(req),
    });
    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    res.send(file.buffer);
  }

  @Get('pending-export')
  @RequireAnyPermission(...SIS_FEES_VIEW)
  async exportPending(
    @CurrentUser() user: JwtUser,
    @Res() res: Response,
    @Req() req: Request,
    @Query('month') month?: string,
    @Query('gradeId') gradeId?: string,
    @Query('sectionId') sectionId?: string,
    @Query('status') status?: string,
    @Query('format') format?: 'pdf' | 'xlsx' | 'html' | 'csv',
    @Query('orientation') orientation?: 'portrait' | 'landscape',
  ) {
    const file = await this.engineReports.export(user.tid, user, {
      key: 'fee_pending',
      format: format || 'xlsx',
      orientation: orientation || 'landscape',
      filters: {
        month: month ?? '',
        gradeId: gradeId && gradeId !== 'all' ? gradeId : '',
        sectionId: sectionId && sectionId !== 'all' ? sectionId : '',
        status: status && status !== 'all' ? status : '',
      },
      ip: extractClientIp(req),
    });
    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    res.send(file.buffer);
  }

  @Get('reports/user-wise-collection')
  @RequireAnyPermission(...SIS_FEES_VIEW)
  userWiseCollection(
    @CurrentUser() user: JwtUser,
    @Query('date') date?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('classId') classId?: string,
    @Query('sectionId') sectionId?: string,
    @Query('paymentMode') paymentMode?: string,
    @Query('userId') userId?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: UserWiseSort,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reports.userWiseCollection(
      user.tid,
      {
        date,
        academicYearId,
        classId,
        sectionId,
        paymentMode,
        userId,
        search,
        sortBy,
        sortOrder,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      },
      reportActor(user),
    );
  }

  @Get('reports/user-wise-collection/export')
  @RequireAnyPermission(...SIS_FEES_VIEW)
  async userWiseExport(
    @CurrentUser() user: JwtUser,
    @Res() res: Response,
    @Req() req: Request,
    @Query('date') date?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('classId') classId?: string,
    @Query('sectionId') sectionId?: string,
    @Query('paymentMode') paymentMode?: string,
    @Query('userId') userId?: string,
    @Query('search') search?: string,
    @Query('format') format?: 'pdf' | 'xlsx' | 'html' | 'csv',
    @Query('orientation') orientation?: 'portrait' | 'landscape',
  ) {
    const file = await this.engineReports.export(user.tid, user, {
      key: 'fee_user_wise',
      format: format || 'xlsx',
      orientation,
      filters: {
        date: date ?? '',
        dateFrom: date ?? '',
        dateTo: date ?? '',
        academicYearId: academicYearId ?? '',
        gradeId: classId ?? '',
        sectionId: sectionId ?? '',
        paymentMode: paymentMode ?? '',
        collectedById: userId ?? '',
      },
      ip: extractClientIp(req),
    });
    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    res.send(file.buffer);
  }

  @Get('reports/user-wise-collection/users/:userId')
  @RequireAnyPermission(...SIS_FEES_VIEW)
  userWiseReceipts(
    @CurrentUser() user: JwtUser,
    @Param('userId') collectorUserId: string,
    @Query('date') date?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('classId') classId?: string,
    @Query('sectionId') sectionId?: string,
    @Query('paymentMode') paymentMode?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reports.userReceipts(
      user.tid,
      collectorUserId,
      {
        date,
        academicYearId,
        classId,
        sectionId,
        paymentMode,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      },
      reportActor(user),
    );
  }

  @Get('reports/cash-close')
  @RequireAnyPermission(...SIS_FEES_VIEW)
  cashClose(
    @CurrentUser() user: JwtUser,
    @Query('userId') userId: string,
    @Query('date') date: string,
  ) {
    return this.reports.getCashClose(user.tid, userId, date);
  }

  @Post('reports/cash-close')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  closeCash(@CurrentUser() user: JwtUser, @Body() dto: CloseSchoolFeeCashDto) {
    return this.reports.closeCashCounter(user.tid, dto, reportActor(user));
  }

  @Post('reports/cash-close/reopen')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  reopenCash(
    @CurrentUser() user: JwtUser,
    @Body() dto: { userId: string; date: string },
  ) {
    return this.reports.reopenCashCounter(
      user.tid,
      dto.userId,
      dto.date,
      reportActor(user),
    );
  }

  @Get('pending')
  @RequireAnyPermission(...SIS_FEES_VIEW)
  pending(@CurrentUser() user: JwtUser, @Query('month') month?: string) {
    return this.fees.pending(user.tid, month);
  }

  @Get('ledger')
  @RequireAnyPermission(...SIS_FEES_VIEW)
  ledger(@CurrentUser() user: JwtUser, @Query('studentId') studentId: string) {
    return this.fees.ledger(user.tid, studentId);
  }

  @Post('payments/:id/send')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  async sendReceipt(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.fees.sendToParent(user.tid, id, user.sub);
  }

  @Get('payments/:id')
  @RequireAnyPermission(...SIS_FEES_VIEW)
  payment(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.fees.getPayment(user.tid, id);
  }

  @Post('payments/:id/void')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  async voidPayment(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: VoidSchoolFeeDto,
  ) {
    const payment = await this.fees.getPayment(user.tid, id);
    await this.reports.assertCounterOpenForVoid(
      user.tid,
      payment.paidAt,
      payment.collectedById,
      reportActor(user).canClose,
    );
    return this.fees.voidPayment(user.tid, id, dto, user.sub);
  }

  @Get('payments/:id/receipt')
  @RequireAnyPermission(...SIS_FEES_VIEW)
  async receiptHtml(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const html = await this.fees.receiptHtml(user.tid, id);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  @Get('payments/:id/pdf')
  @RequireAnyPermission(...SIS_FEES_VIEW)
  async receiptPdf(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const buf = await this.fees.receiptPdf(user.tid, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="fee-receipt-${id}.pdf"`,
    );
    res.send(buf);
  }
}
