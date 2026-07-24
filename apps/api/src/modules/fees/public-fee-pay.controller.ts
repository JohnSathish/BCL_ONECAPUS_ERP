import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ClsService } from 'nestjs-cls';
import { Public } from '../../common/decorators/public.decorator';
import { CLS_TENANT_ID } from '../../common/cls/cls.constants';
import { extractClientIp } from '../../common/utils/request-host';
import { TenantResolutionService } from '../tenants/tenant-resolution.service';
import { PublicFeePayService } from './services/public-fee-pay.service';
import {
  PublicFeeInitiateDto,
  PublicFeeLookupDto,
  PublicFeeSimulateDto,
  PublicFeeVerifyRazorpayDto,
} from './dto/public-fee-pay.dto';

@ApiTags('public-fees')
@Controller({ path: 'public/fees', version: '1' })
export class PublicFeePayController {
  constructor(
    private readonly publicFees: PublicFeePayService,
    private readonly cls: ClsService,
    private readonly tenantResolution: TenantResolutionService,
  ) {}

  private resolveHost(req: Request): string {
    const loginHost = String(req.headers['x-login-host'] ?? '').trim();
    if (loginHost) return loginHost;
    const fromHeaders = this.tenantResolution.extractHostFromHeaders(
      req.headers.host,
      req.headers['x-forwarded-host'],
    );
    if (
      !fromHeaders ||
      fromHeaders === 'localhost' ||
      fromHeaders === '127.0.0.1' ||
      fromHeaders === 'pay.localhost'
    ) {
      return 'demo.localhost';
    }
    return fromHeaders;
  }

  private async resolveTenantId(req: Request): Promise<string> {
    const fromCls = this.cls.get<string>(CLS_TENANT_ID);
    if (fromCls) return fromCls;
    const host = this.resolveHost(req);
    const tenant = await this.tenantResolution.resolveHost(host);
    if (!tenant) throw new BadRequestException('Tenant context required');
    return tenant.id;
  }

  private clientMeta(req: Request, ip: string, userAgent?: string) {
    return {
      ipAddress: extractClientIp(req) || ip || undefined,
      userAgent: userAgent ?? undefined,
    };
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('challenge')
  challenge() {
    return this.publicFees.getChallenge();
  }

  @Public()
  @Throttle({ default: { limit: 12, ttl: 900_000 } })
  @Post('lookup')
  async lookup(
    @Req() req: Request,
    @Body() dto: PublicFeeLookupDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    const tenantId = await this.resolveTenantId(req);
    return this.publicFees.lookup(
      tenantId,
      dto,
      this.clientMeta(req, ip, userAgent),
    );
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 900_000 } })
  @Post('pay/initiate')
  async initiate(
    @Req() req: Request,
    @Body() dto: PublicFeeInitiateDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    const tenantId = await this.resolveTenantId(req);
    return this.publicFees.initiate(
      tenantId,
      dto,
      this.clientMeta(req, ip, userAgent),
    );
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 900_000 } })
  @Post('pay/verify')
  async verify(
    @Req() req: Request,
    @Body() dto: PublicFeeVerifyRazorpayDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    const tenantId = await this.resolveTenantId(req);
    return this.publicFees.verifyRazorpay(
      tenantId,
      dto,
      this.clientMeta(req, ip, userAgent),
    );
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 900_000 } })
  @Post('pay/simulate-mock')
  async simulate(
    @Req() req: Request,
    @Body() dto: PublicFeeSimulateDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    const tenantId = await this.resolveTenantId(req);
    return this.publicFees.simulateMock(
      tenantId,
      dto.paymentSessionToken,
      dto.paymentId,
      this.clientMeta(req, ip, userAgent),
    );
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 900_000 } })
  @Get('receipt/:receiptId/pdf')
  async receiptPdf(
    @Req() req: Request,
    @Param('receiptId') receiptId: string,
    @Query('paymentSessionToken') paymentSessionToken?: string,
    @Query('receiptAccessToken') receiptAccessToken?: string,
    @Res() res?: Response,
  ) {
    const tenantId = await this.resolveTenantId(req);
    const access = receiptAccessToken
      ? { receiptAccessToken }
      : { paymentSessionToken: paymentSessionToken ?? '' };
    const { buffer, receiptNo } = await this.publicFees.getReceiptPdf(
      tenantId,
      receiptId,
      access as any,
    );
    res!.setHeader('Content-Type', 'application/pdf');
    res!.setHeader(
      'Content-Disposition',
      `inline; filename="${receiptNo || 'receipt'}.pdf"`,
    );
    res!.send(buffer);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 900_000 } })
  @Get('verify-receipt')
  async verifyReceipt(
    @Req() req: Request,
    @Query('receiptNo') receiptNo: string,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    if (!receiptNo?.trim()) {
      throw new BadRequestException('receiptNo is required');
    }
    const tenantId = await this.resolveTenantId(req);
    return this.publicFees.verifyReceiptByNumber(
      tenantId,
      receiptNo,
      this.clientMeta(req, ip, userAgent),
    );
  }
}
