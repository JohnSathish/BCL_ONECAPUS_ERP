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
  SIS_ACCOUNTS_APPROVE,
  SIS_ACCOUNTS_BUDGET,
  SIS_ACCOUNTS_CHART,
  SIS_ACCOUNTS_CLOSE,
  SIS_ACCOUNTS_CREATE,
  SIS_ACCOUNTS_EXPORT,
  SIS_ACCOUNTS_POST,
  SIS_ACCOUNTS_RECON,
  SIS_ACCOUNTS_REVERSE,
  SIS_ACCOUNTS_TAX,
  SIS_ACCOUNTS_VIEW,
} from './school-sis-accounts.perms';
import { SchoolSisAccountsService } from './school-sis-accounts.service';
import {
  AcctAccountDto,
  AcctApprovalRuleDto,
  AcctAssetDto,
  AcctBankDto,
  AcctBankImportDto,
  AcctBillDto,
  AcctBudgetDto,
  AcctCashCloseDto,
  AcctGatewaySettleDto,
  AcctTaxConfigDto,
  AcctVendorDto,
  AcctVoucherDto,
} from './dto/school-accounts.dto';

@ApiBearerAuth()
@ApiTags('school-sis-accounts')
@RequiresSchoolLicense('accounts')
@Controller({ path: 'school-sis/accounts', version: '1' })
export class SchoolSisAccountsController {
  constructor(private readonly acct: SchoolSisAccountsService) {}

  @Get('bootstrap')
  @RequireAnyPermission(...SIS_ACCOUNTS_VIEW)
  bootstrap(@CurrentUser() user: JwtUser) {
    return this.acct.bootstrap(user.tid);
  }

  @Get('dashboard')
  @RequireAnyPermission(...SIS_ACCOUNTS_VIEW)
  dash(@CurrentUser() user: JwtUser, @Query('view') view?: string) {
    return this.acct.dashboard(user.tid, view);
  }

  @Get('chart')
  @RequireAnyPermission(...SIS_ACCOUNTS_VIEW)
  chart(@CurrentUser() user: JwtUser) {
    return this.acct.chart(user.tid);
  }

  @Post('chart')
  @RequireAnyPermission(...SIS_ACCOUNTS_CHART)
  addAccount(@CurrentUser() user: JwtUser, @Body() body: AcctAccountDto) {
    return this.acct.saveAccount(user.tid, body);
  }

  @Patch('chart/:id')
  @RequireAnyPermission(...SIS_ACCOUNTS_CHART)
  editAccount(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: AcctAccountDto,
  ) {
    return this.acct.saveAccount(user.tid, body, id);
  }

  @Post('chart/:id/active')
  @RequireAnyPermission(...SIS_ACCOUNTS_CHART)
  toggle(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { active: boolean },
  ) {
    return this.acct.setAccountActive(user.tid, id, body.active);
  }

  @Get('vouchers')
  @RequireAnyPermission(...SIS_ACCOUNTS_VIEW)
  vouchers(
    @CurrentUser() user: JwtUser,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('search') search?: string,
    @Query('createdBy') createdBy?: string,
  ) {
    return this.acct.vouchers(user.tid, {
      type,
      status,
      from,
      to,
      search,
      createdBy,
    });
  }

  @Get('vouchers/:id')
  @RequireAnyPermission(...SIS_ACCOUNTS_VIEW)
  one(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.acct.getVoucher(user.tid, id);
  }

  @Post('vouchers')
  @RequireAnyPermission(...SIS_ACCOUNTS_CREATE)
  create(
    @CurrentUser() user: JwtUser,
    @Body() body: AcctVoucherDto,
    @Req() req: Request,
  ) {
    return this.acct.createVoucher(
      user.tid,
      body,
      user.sub,
      extractClientIp(req),
    );
  }

  @Post('vouchers/:id/submit')
  @RequireAnyPermission(...SIS_ACCOUNTS_CREATE)
  submit(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.acct.submit(user.tid, id, user.sub);
  }

  @Post('vouchers/:id/approve')
  @RequireAnyPermission(...SIS_ACCOUNTS_APPROVE)
  approve(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.acct.approve(user.tid, id, user.sub, user.roles ?? []);
  }

  @Post('vouchers/:id/post')
  @RequireAnyPermission(...SIS_ACCOUNTS_POST)
  post(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.acct.postDraft(user.tid, id, user.sub);
  }

  @Post('vouchers/:id/reverse')
  @RequireAnyPermission(...SIS_ACCOUNTS_REVERSE)
  reverse(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.acct.reverse(user.tid, id, user.sub);
  }

  @Get('ledger')
  @RequireAnyPermission(...SIS_ACCOUNTS_VIEW)
  ledger(
    @CurrentUser() user: JwtUser,
    @Query('accountId') accountId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.acct.ledger(user.tid, { accountId, from, to });
  }

  @Get('trial-balance')
  @RequireAnyPermission(...SIS_ACCOUNTS_VIEW)
  tb(@CurrentUser() user: JwtUser) {
    return this.acct.trialBalance(user.tid);
  }

  @Get('statements')
  @RequireAnyPermission(...SIS_ACCOUNTS_VIEW)
  statements(@CurrentUser() user: JwtUser) {
    return this.acct.statements(user.tid);
  }

  @Get('cashier-collection')
  @RequireAnyPermission(...SIS_ACCOUNTS_VIEW)
  cashier(
    @CurrentUser() user: JwtUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('userId') userId?: string,
  ) {
    return this.acct.cashierCollection(user.tid, { from, to, userId });
  }

  @Post('cash-close')
  @RequireAnyPermission(...SIS_ACCOUNTS_CREATE)
  closeCash(@CurrentUser() user: JwtUser, @Body() body: AcctCashCloseDto) {
    return this.acct.cashClose(user.tid, body, user.sub);
  }

  @Get('banks')
  @RequireAnyPermission(...SIS_ACCOUNTS_VIEW)
  banks(@CurrentUser() user: JwtUser) {
    return this.acct.banks(user.tid);
  }

  @Post('banks')
  @RequireAnyPermission(...SIS_ACCOUNTS_CHART)
  saveBank(@CurrentUser() user: JwtUser, @Body() body: AcctBankDto) {
    return this.acct.saveBank(user.tid, body);
  }

  @Post('banks/import')
  @RequireAnyPermission(...SIS_ACCOUNTS_RECON)
  importBank(@CurrentUser() user: JwtUser, @Body() body: AcctBankImportDto) {
    return this.acct.importBank(user.tid, body, user.sub);
  }

  @Get('banks/:id/recon')
  @RequireAnyPermission(...SIS_ACCOUNTS_RECON)
  recon(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.acct.reconSummary(user.tid, id);
  }

  @Get('vendors')
  @RequireAnyPermission(...SIS_ACCOUNTS_VIEW)
  vendors(@CurrentUser() user: JwtUser) {
    return this.acct.vendors(user.tid);
  }

  @Post('vendors')
  @RequireAnyPermission(...SIS_ACCOUNTS_CREATE)
  saveVendor(@CurrentUser() user: JwtUser, @Body() body: AcctVendorDto) {
    return this.acct.saveVendor(user.tid, body);
  }

  @Post('bills')
  @RequireAnyPermission(...SIS_ACCOUNTS_CREATE)
  bill(@CurrentUser() user: JwtUser, @Body() body: AcctBillDto) {
    return this.acct.saveBill(user.tid, body, user.sub);
  }

  @Post('bills/:id/:status')
  @RequireAnyPermission(...SIS_ACCOUNTS_APPROVE)
  billStatus(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('status') status: string,
  ) {
    return this.acct.transitionBill(user.tid, id, status);
  }

  @Get('budgets')
  @RequireAnyPermission(...SIS_ACCOUNTS_VIEW)
  budgets(@CurrentUser() user: JwtUser) {
    return this.acct.budgets(user.tid);
  }

  @Post('budgets')
  @RequireAnyPermission(...SIS_ACCOUNTS_BUDGET)
  saveBudget(@CurrentUser() user: JwtUser, @Body() body: AcctBudgetDto) {
    return this.acct.saveBudget(user.tid, body);
  }

  @Get('budget-vs-actual')
  @RequireAnyPermission(...SIS_ACCOUNTS_VIEW)
  bva(@CurrentUser() user: JwtUser) {
    return this.acct.budgetVsActual(user.tid);
  }

  @Get('cost-centres')
  @RequireAnyPermission(...SIS_ACCOUNTS_VIEW)
  cc(@CurrentUser() user: JwtUser) {
    return this.acct.costCentres(user.tid);
  }

  @Get('assets')
  @RequireAnyPermission(...SIS_ACCOUNTS_VIEW)
  assets(@CurrentUser() user: JwtUser) {
    return this.acct.assets(user.tid);
  }

  @Post('assets')
  @RequireAnyPermission(...SIS_ACCOUNTS_CREATE)
  saveAsset(@CurrentUser() user: JwtUser, @Body() body: AcctAssetDto) {
    return this.acct.saveAsset(user.tid, body);
  }

  @Post('assets/depreciate')
  @RequireAnyPermission(...SIS_ACCOUNTS_POST)
  dep(@CurrentUser() user: JwtUser, @Body() body: { periodCode: string }) {
    return this.acct.depreciate(user.tid, body.periodCode, user.sub);
  }

  @Get('tax')
  @RequireAnyPermission(...SIS_ACCOUNTS_VIEW)
  tax(@CurrentUser() user: JwtUser) {
    return this.acct.taxConfigs(user.tid);
  }

  @Post('tax')
  @RequireAnyPermission(...SIS_ACCOUNTS_TAX)
  saveTax(@CurrentUser() user: JwtUser, @Body() body: AcctTaxConfigDto) {
    return this.acct.saveTax(user.tid, body);
  }

  @Get('periods')
  @RequireAnyPermission(...SIS_ACCOUNTS_VIEW)
  periods(@CurrentUser() user: JwtUser) {
    return this.acct.periods(user.tid);
  }

  @Post('periods/:id/lock')
  @RequireAnyPermission(...SIS_ACCOUNTS_CLOSE)
  lock(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.acct.lockPeriod(user.tid, id, user.sub);
  }

  @Post('year-end')
  @RequireAnyPermission(...SIS_ACCOUNTS_CLOSE)
  yearEnd(@CurrentUser() user: JwtUser) {
    return this.acct.yearEnd(user.tid, user.sub);
  }

  @Get('audit')
  @RequireAnyPermission(...SIS_ACCOUNTS_VIEW)
  audit(@CurrentUser() user: JwtUser) {
    return this.acct.audit(user.tid);
  }

  @Get('approval-rules')
  @RequireAnyPermission(...SIS_ACCOUNTS_VIEW)
  rules(@CurrentUser() user: JwtUser) {
    return this.acct.approvalRules(user.tid);
  }

  @Post('approval-rules')
  @RequireAnyPermission(...SIS_ACCOUNTS_CHART)
  saveRule(@CurrentUser() user: JwtUser, @Body() body: AcctApprovalRuleDto) {
    return this.acct.saveRule(user.tid, body);
  }

  @Post('gateway-settlement')
  @RequireAnyPermission(...SIS_ACCOUNTS_POST)
  settle(@CurrentUser() user: JwtUser, @Body() body: AcctGatewaySettleDto) {
    return this.acct.settleGateway(user.tid, body, user.sub);
  }

  @Get('export/:key')
  @RequireAnyPermission(...SIS_ACCOUNTS_EXPORT)
  async export(
    @CurrentUser() user: JwtUser,
    @Param('key') key: string,
    @Query('format') format: 'pdf' | 'xlsx' | 'csv' | 'html' = 'pdf',
    @Res() res: Response,
  ) {
    const out = await this.acct.exportReport(user.tid, key, format, user.sub);
    res.setHeader('Content-Type', out.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${out.filename}"`,
    );
    return res.send(out.buffer);
  }
}
