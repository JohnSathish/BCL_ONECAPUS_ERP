import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Headers,
  Ip,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { extractClientIp } from '../../common/utils/request-host';
import { FeeCollectionCenterService } from './fee-collection-center.service';
import {
  CenterGatewayPayDto,
  CenterReviewDto,
  CenterStatusActionDto,
  CenterPasswordResetDto,
  RegisterFeeCollectionCenterDto,
  VerifyCenterEmailDto,
  VerifyCenterOtpDto,
} from './dto/fee-collection-center.dto';
import { GatewayPaymentService } from '../fees/services/gateway-payment.service';
import { FeeReceiptDocumentService } from '../fees/services/fee-receipt-document.service';

@ApiTags('fee-collection-centers')
@Controller({ path: 'fee-collection-centers', version: '1' })
export class FeeCollectionCenterController {
  constructor(
    private readonly centers: FeeCollectionCenterService,
    private readonly gateways: GatewayPaymentService,
    private readonly receiptDocs: FeeReceiptDocumentService,
  ) {}

  private tenantId(req: { tenantId?: string }) {
    if (!req.tenantId) {
      throw new BadRequestException('Tenant context required');
    }
    return req.tenantId;
  }

  private clientMeta(req: any, ip: string, userAgent?: string) {
    return {
      ipAddress: extractClientIp(req) || ip || undefined,
      userAgent: userAgent ?? undefined,
    };
  }

  @Public()
  @Throttle({ default: { limit: 8, ttl: 900_000 } })
  @Post('register')
  register(
    @Body() dto: RegisterFeeCollectionCenterDto,
    @Req() req: { tenantId?: string },
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.centers.register(
      this.tenantId(req),
      dto,
      this.clientMeta(req, ip, userAgent),
    );
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 900_000 } })
  @Post('verify-email')
  verifyEmail(
    @Body() dto: VerifyCenterEmailDto,
    @Req() req: { tenantId?: string },
  ) {
    return this.centers.verifyEmail(
      this.tenantId(req),
      dto.centerId,
      dto.token,
    );
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 900_000 } })
  @Post('verify-otp')
  verifyOtp(
    @Body() dto: VerifyCenterOtpDto,
    @Req() req: { tenantId?: string },
  ) {
    return this.centers.verifyOtp(this.tenantId(req), dto.centerId, dto.otp);
  }

  @ApiBearerAuth()
  @Get('me/dashboard')
  @RequireAnyPermission(
    'fees:collection-center:self',
    'fees:collection-center:pay',
  )
  dashboard(@CurrentUser() user: JwtUser) {
    return this.centers.dashboard(user);
  }

  @ApiBearerAuth()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('me/students/search')
  @RequireAnyPermission(
    'fees:collection-center:self',
    'fees:collection-center:pay',
  )
  search(@CurrentUser() user: JwtUser, @Query('q') q: string) {
    return this.centers.searchStudent(user, q ?? '');
  }

  @ApiBearerAuth()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('me/payments/initiate')
  @RequirePermissions('fees:collection-center:pay')
  initiate(
    @CurrentUser() user: JwtUser,
    @Body() dto: CenterGatewayPayDto,
    @Req() req: any,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.centers.initiatePayment(
      user,
      dto,
      this.clientMeta(req, ip, userAgent),
    );
  }

  @ApiBearerAuth()
  @Post('me/payments/verify-razorpay')
  @RequirePermissions('fees:collection-center:pay')
  verifyRazorpay(@CurrentUser() user: JwtUser, @Body() dto: any) {
    return this.gateways.verifyRazorpay(user, dto);
  }

  @ApiBearerAuth()
  @Post('me/payments/:paymentId/simulate-mock')
  @RequirePermissions('fees:collection-center:pay')
  simulateMock(
    @CurrentUser() user: JwtUser,
    @Param('paymentId') paymentId: string,
  ) {
    return this.gateways.simulateMockPayment(user, paymentId);
  }

  @ApiBearerAuth()
  @Post('me/payments/:paymentId/reconcile')
  @RequirePermissions('fees:collection-center:pay')
  reconcile(
    @CurrentUser() user: JwtUser,
    @Param('paymentId') paymentId: string,
  ) {
    return this.gateways.reconcilePaymentTransaction(user, paymentId);
  }

  @ApiBearerAuth()
  @Get('me/receipts/:receiptId/pdf')
  @RequireAnyPermission(
    'fees:collection-center:self',
    'fees:collection-center:pay',
  )
  async receiptPdf(
    @CurrentUser() user: JwtUser,
    @Param('receiptId') receiptId: string,
    @Res() res: Response,
  ) {
    await this.centers.assertOwnReceipt(user, receiptId);
    const { buffer, receiptNo } = await this.receiptDocs.generatePdfBuffer(
      user.tid,
      receiptId,
    );
    const safeName = receiptNo.replace(/\//g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${safeName}.pdf"`);
    return res.send(buffer);
  }

  @ApiBearerAuth()
  @Get('me/transactions')
  @RequireAnyPermission(
    'fees:collection-center:self',
    'fees:collection-center:pay',
  )
  myTransactions(
    @CurrentUser() user: JwtUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
  ) {
    return this.centers.listMyTransactions(user, { from, to, status });
  }

  // ——— Admin (static paths before :id) ———

  @ApiBearerAuth()
  @Get('admin/transactions')
  @RequireAnyPermission('fees:manage', 'fees:read')
  adminTx(
    @CurrentUser() user: JwtUser,
    @Query('centerId') centerId?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.centers.adminTransactions(user.tid, {
      centerId,
      status,
      from,
      to,
    });
  }

  @ApiBearerAuth()
  @Get('admin/reports/:type')
  @RequireAnyPermission('fees:manage', 'fees:read', 'reports:read')
  reports(
    @CurrentUser() user: JwtUser,
    @Param('type') type: 'daily' | 'monthly' | 'center',
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.centers.reports(user.tid, type, { from, to });
  }

  @ApiBearerAuth()
  @Get()
  @RequireAnyPermission('fees:manage', 'fees:read')
  list(
    @CurrentUser() user: JwtUser,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.centers.listCenters(user.tid, { status, search });
  }

  @ApiBearerAuth()
  @Post(':id/review')
  @RequirePermissions('fees:manage')
  review(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: CenterReviewDto,
    @Req() req: any,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.centers.review(
      user,
      id,
      dto,
      this.clientMeta(req, ip, userAgent),
    );
  }

  @ApiBearerAuth()
  @Post(':id/suspend')
  @RequirePermissions('fees:manage')
  suspend(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: CenterStatusActionDto,
  ) {
    return this.centers.setStatus(user, id, 'SUSPENDED', dto.reason);
  }

  @ApiBearerAuth()
  @Post(':id/block')
  @RequirePermissions('fees:manage')
  block(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: CenterStatusActionDto,
  ) {
    return this.centers.setStatus(user, id, 'BLOCKED', dto.reason);
  }

  @ApiBearerAuth()
  @Post(':id/reactivate')
  @RequirePermissions('fees:manage')
  reactivate(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.centers.setStatus(user, id, 'APPROVED');
  }

  @ApiBearerAuth()
  @Post(':id/reset-password')
  @RequirePermissions('fees:manage')
  resetPassword(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: CenterPasswordResetDto,
  ) {
    return this.centers.resetOperatorPassword(user, id, dto.newPassword);
  }
}
