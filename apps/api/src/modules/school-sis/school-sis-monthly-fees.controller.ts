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
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import {
  SCHOOL_SIS_PERMISSION_MANAGE,
  SCHOOL_SIS_PERMISSION_READ,
} from './school-sis.constants';
import {
  CollectSchoolFeeDto,
  CloseSchoolFeeCashDto,
  SaveSchoolFeeSettingsDto,
  SaveSchoolMonthlyFeePlanDto,
  VoidSchoolFeeDto,
} from './dto/school-sis.dto';
import { SchoolSisMonthlyFeesService } from './school-sis-monthly-fees.service';
import {
  SchoolSisFeeReportsService,
  type UserWiseSort,
} from './school-sis-fee-reports.service';

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
@Controller({ path: 'school-sis/fees/monthly', version: '1' })
export class SchoolSisMonthlyFeesController {
  constructor(
    private readonly fees: SchoolSisMonthlyFeesService,
    private readonly reports: SchoolSisFeeReportsService,
  ) {}

  @Get('config')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  config(@CurrentUser() user: JwtUser) {
    return this.fees.getConfig(user.tid);
  }

  @Patch('config')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  saveConfig(
    @CurrentUser() user: JwtUser,
    @Body() dto: SaveSchoolFeeSettingsDto,
  ) {
    return this.fees.saveSettings(user.tid, dto);
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
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  quote(
    @CurrentUser() user: JwtUser,
    @Query('studentId') studentId: string,
    @Query('month') month: string,
  ) {
    return this.fees.quote(user.tid, studentId, month);
  }

  @Post('collect')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
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

  @Get('dashboard')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  dashboard(@CurrentUser() user: JwtUser) {
    return this.fees.dashboard(user.tid);
  }

  @Get('register')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
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
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  async exportRegister(
    @CurrentUser() user: JwtUser,
    @Res() res: Response,
    @Query('month') month?: string,
    @Query('gradeId') gradeId?: string,
    @Query('status') status?: string,
  ) {
    const file = await this.fees.exportRegister(user.tid, {
      month,
      gradeId,
      status,
    });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    res.send(file.buffer);
  }

  @Get('reports/user-wise-collection')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
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
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  async userWiseExport(
    @CurrentUser() user: JwtUser,
    @Res() res: Response,
    @Query('date') date?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('classId') classId?: string,
    @Query('sectionId') sectionId?: string,
    @Query('paymentMode') paymentMode?: string,
    @Query('userId') userId?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: UserWiseSort,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    const buffer = await this.reports.userWiseExcel(
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
      },
      reportActor(user),
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="user-wise-collection-${date || 'today'}.xlsx"`,
    );
    res.send(buffer);
  }

  @Get('reports/user-wise-collection/users/:userId')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
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
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
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
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  pending(@CurrentUser() user: JwtUser, @Query('month') month?: string) {
    return this.fees.pending(user.tid, month);
  }

  @Get('ledger')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  ledger(@CurrentUser() user: JwtUser, @Query('studentId') studentId: string) {
    return this.fees.ledger(user.tid, studentId);
  }

  @Post('payments/:id/send')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  async sendReceipt(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.fees.sendToParent(user.tid, id, user.sub);
  }

  @Get('payments/:id')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
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
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
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
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
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
