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

import { join } from 'path';

import { existsSync } from 'fs';

import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';

import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';

import { PAYROLL_READ_ACCESS } from '../../common/permissions/payroll.permissions';

const LOANS_WRITE_ACCESS = ['loans:manage', 'payroll:manage'] as const;

import {
  CancelLoanReceiptDto,
  CreateLoanTypeDto,
  CreateStaffLoanDto,
  EmailLoanReceiptDto,
  ListLoansQueryDto,
  RecordLoanPaymentDto,
  RestructureLoanDto,
  StaffSearchQueryDto,
  UpdateLoanTypeDto,
} from './dto/loans.dto';

import { LoansDashboardService } from './services/loans-dashboard.service';

import { LoansManagementService } from './services/loans-management.service';

import { LoansReceiptService } from './services/loans-receipt.service';

import { LoansReportsService } from './services/loans-reports.service';

import { LoansSetupService } from './services/loans-setup.service';

@ApiBearerAuth()
@ApiTags('loans')
@Controller({ path: 'loans', version: '1' })
export class LoansController {
  constructor(
    private readonly management: LoansManagementService,

    private readonly dashboard: LoansDashboardService,

    private readonly reports: LoansReportsService,

    private readonly setup: LoansSetupService,

    private readonly receipts: LoansReceiptService,
  ) {}

  @Get('dashboard')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS, 'loans:read')
  getDashboard(@CurrentUser() user: JwtUser) {
    return this.dashboard.dashboard(user.tid);
  }

  @Get('staff/search')
  @RequireAnyPermission(
    ...LOANS_WRITE_ACCESS,
    ...PAYROLL_READ_ACCESS,
    'loans:read',
  )
  searchStaff(
    @CurrentUser() user: JwtUser,
    @Query() query: StaffSearchQueryDto,
  ) {
    return this.management.searchStaff(user.tid, query.q);
  }

  @Get('types')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS, 'loans:read')
  listTypes(@CurrentUser() user: JwtUser, @Query('all') all?: string) {
    return this.setup.listTypes(user.tid, all !== 'true');
  }

  @Post('types')
  @RequireAnyPermission(...LOANS_WRITE_ACCESS)
  createType(@CurrentUser() user: JwtUser, @Body() dto: CreateLoanTypeDto) {
    return this.setup.createType(user, dto);
  }

  @Patch('types/:id')
  @RequireAnyPermission(...LOANS_WRITE_ACCESS)
  updateType(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateLoanTypeDto,
  ) {
    return this.setup.updateType(user.tid, id, dto);
  }

  @Get()
  @RequireAnyPermission(...PAYROLL_READ_ACCESS, 'loans:read')
  list(@CurrentUser() user: JwtUser, @Query() query: ListLoansQueryDto) {
    return this.management.list(user.tid, query);
  }

  @Post()
  @RequireAnyPermission(...LOANS_WRITE_ACCESS)
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateStaffLoanDto) {
    return this.management.create(user, dto);
  }

  @Get('reports/register')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS, 'loans:reports')
  register(@CurrentUser() user: JwtUser) {
    return this.reports.loanRegister(user.tid);
  }

  @Get('reports/outstanding')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS, 'loans:reports')
  outstanding(@CurrentUser() user: JwtUser) {
    return this.reports.outstandingReport(user.tid);
  }

  @Get('reports/recovery')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS, 'loans:reports')
  recovery(
    @CurrentUser() user: JwtUser,

    @Query('month') month: number,

    @Query('year') year: number,
  ) {
    return this.reports.recoveryReport(user.tid, Number(month), Number(year));
  }

  @Get('reports/daily-collection')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS, 'loans:reports')
  dailyCollection(@CurrentUser() user: JwtUser, @Query('date') date: string) {
    return this.reports.dailyCollectionReport(user.tid, date);
  }

  @Get('reports/monthly-collection')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS, 'loans:reports')
  monthlyCollection(
    @CurrentUser() user: JwtUser,

    @Query('month') month: number,

    @Query('year') year: number,
  ) {
    return this.reports.monthlyCollectionReport(
      user.tid,
      Number(month),
      Number(year),
    );
  }

  @Get('reports/receipt-register')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS, 'loans:reports')
  receiptRegister(
    @CurrentUser() user: JwtUser,

    @Query('from') from?: string,

    @Query('to') to?: string,
  ) {
    return this.reports.receiptRegister(user.tid, from, to);
  }

  @Get('reports/cash-receipts')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS, 'loans:reports')
  cashReceipts(
    @CurrentUser() user: JwtUser,

    @Query('month') month?: number,

    @Query('year') year?: number,
  ) {
    return this.reports.cashReceiptRegister(
      user.tid,
      month ? Number(month) : undefined,
      year ? Number(year) : undefined,
    );
  }

  @Get('reports/closures')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS, 'loans:reports')
  closures(@CurrentUser() user: JwtUser) {
    return this.reports.closureReport(user.tid);
  }

  @Get('reports/staff-repayments')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS, 'loans:reports')
  staffRepayments(
    @CurrentUser() user: JwtUser,
    @Query('staffProfileId') staffProfileId: string,
  ) {
    return this.reports.staffRepaymentReport(user.tid, staffProfileId);
  }

  @Get('reports/register/export')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS, 'loans:reports')
  async exportRegister(@CurrentUser() user: JwtUser, @Res() res: Response) {
    const buf = await this.reports.registerExcelBuffer(user.tid);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );

    res.setHeader(
      'Content-Disposition',
      'attachment; filename=loan-register.xlsx',
    );

    return res.send(buf);
  }

  @Get('reports/receipt-register/export')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS, 'loans:reports')
  async exportReceiptRegister(
    @CurrentUser() user: JwtUser,
    @Res() res: Response,
  ) {
    const buf = await this.reports.receiptRegisterExcelBuffer(user.tid);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );

    res.setHeader(
      'Content-Disposition',
      'attachment; filename=loan-receipt-register.xlsx',
    );

    return res.send(buf);
  }

  @Get('transactions/:transactionId/receipt')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS, 'loans:read')
  async getReceiptMeta(
    @CurrentUser() user: JwtUser,
    @Param('transactionId') transactionId: string,
  ) {
    const pdfPath = await this.receipts.generateReceiptPdf(
      user.tid,
      transactionId,
    );

    return {
      pdfPath,
      printUrl: `/v1/loans/transactions/${transactionId}/receipt/pdf`,
    };
  }

  @Get('transactions/:transactionId/receipt/pdf')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS, 'loans:read')
  async receiptPdf(
    @CurrentUser() user: JwtUser,

    @Param('transactionId') transactionId: string,

    @Res() res: Response,
  ) {
    const pdfPath = await this.receipts.generateReceiptPdf(
      user.tid,
      transactionId,
    );

    const abs = join(process.cwd(), pdfPath.replace(/^\//, ''));

    if (!existsSync(abs)) {
      return res.redirect(pdfPath);
    }

    res.setHeader('Content-Type', 'application/pdf');

    res.setHeader('Content-Disposition', `inline; filename="loan-receipt.pdf"`);

    return res.sendFile(abs);
  }

  @Post('transactions/:transactionId/cancel')
  @RequireAnyPermission(...LOANS_WRITE_ACCESS)
  cancelReceipt(
    @CurrentUser() user: JwtUser,

    @Param('transactionId') transactionId: string,

    @Body() dto: CancelLoanReceiptDto,
  ) {
    return this.receipts.cancelReceipt(user, transactionId, dto.reason);
  }

  @Post('transactions/:transactionId/email')
  @RequireAnyPermission(...LOANS_WRITE_ACCESS)
  emailReceipt(
    @CurrentUser() user: JwtUser,

    @Param('transactionId') transactionId: string,

    @Body() dto: EmailLoanReceiptDto,
  ) {
    return this.receipts.emailReceipt(user.tid, transactionId, dto.email);
  }

  @Get(':id')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS, 'loans:read')
  get(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.management.get(user.tid, id);
  }

  @Get(':id/statement')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS, 'loans:read')
  statement(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.management.getStatement(user.tid, id);
  }

  @Get(':id/closure-certificate/pdf')
  @RequireAnyPermission(...PAYROLL_READ_ACCESS, 'loans:read')
  async closureCertificatePdf(
    @CurrentUser() user: JwtUser,

    @Param('id') id: string,

    @Res() res: Response,
  ) {
    const pdfPath = await this.receipts.generateClosureCertificate(
      user.tid,
      id,
    );

    const abs = join(process.cwd(), pdfPath.replace(/^\//, ''));

    if (!existsSync(abs)) {
      return res.redirect(pdfPath);
    }

    res.setHeader('Content-Type', 'application/pdf');

    res.setHeader(
      'Content-Disposition',
      `inline; filename="loan-closure-certificate.pdf"`,
    );

    return res.sendFile(abs);
  }

  @Post(':id/payments')
  @RequireAnyPermission(...LOANS_WRITE_ACCESS)
  recordPayment(
    @CurrentUser() user: JwtUser,

    @Param('id') id: string,

    @Body() dto: RecordLoanPaymentDto,
  ) {
    return this.management.recordPayment(user, id, dto);
  }

  @Patch(':id/restructure')
  @RequireAnyPermission(...LOANS_WRITE_ACCESS)
  restructure(
    @CurrentUser() user: JwtUser,

    @Param('id') id: string,

    @Body() dto: RestructureLoanDto,
  ) {
    return this.management.restructure(user, id, dto);
  }
}
