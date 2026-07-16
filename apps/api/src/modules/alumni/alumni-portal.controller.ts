import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { TenantResolutionService } from '../tenants/tenant-resolution.service';
import { AlumniDocumentsService } from './services/alumni-documents.service';
import { AlumniPaymentService } from './services/alumni-payment.service';
import {
  AlumniService,
  type AlumniRegisterDto,
} from './services/alumni.service';

@ApiTags('alumni-portal')
@Controller({ path: 'alumni/portal', version: '1' })
export class AlumniPortalController {
  constructor(
    private readonly alumni: AlumniService,
    private readonly alumniPayments: AlumniPaymentService,
    private readonly alumniDocuments: AlumniDocumentsService,
    private readonly tenantResolution: TenantResolutionService,
  ) {}

  private resolveHost(req: Request): string {
    const loginHost = String(req.headers['x-login-host'] ?? '').trim();
    if (loginHost) return loginHost;
    return (
      this.tenantResolution.extractHostFromHeaders(
        req.headers.host,
        req.headers['x-forwarded-host'],
      ) || 'alumni.demo.localhost'
    );
  }

  private async resolveTenantId(req: Request): Promise<string> {
    const host = this.resolveHost(req);
    const tenant = await this.tenantResolution.resolveHost(host);
    if (!tenant) throw new BadRequestException('Unknown alumni portal host');
    return tenant.id;
  }

  @Public()
  @Get('info')
  async info(@Req() req: Request) {
    const tenantId = await this.resolveTenantId(req);
    return this.alumni.getPortalInfo(tenantId);
  }

  @Public()
  @Get('directory')
  async directory(
    @Req() req: Request,
    @Query('q') q?: string,
    @Query('graduationYear') graduationYear?: string,
    @Query('department') department?: string,
  ) {
    const tenantId = await this.resolveTenantId(req);
    return this.alumni.listDirectory(tenantId, {
      q,
      department,
      graduationYear: graduationYear ? Number(graduationYear) : undefined,
    });
  }

  @Public()
  @Get('events')
  async events(@Req() req: Request) {
    const tenantId = await this.resolveTenantId(req);
    return this.alumni.listPublishedEvents(tenantId);
  }

  @Public()
  @Throttle({ default: { limit: 6, ttl: 900_000 } })
  @Post('register')
  async register(@Req() req: Request, @Body() dto: AlumniRegisterDto) {
    const tenantId = await this.resolveTenantId(req);
    return this.alumni.registerPublic(tenantId, dto);
  }

  @Public()
  @Get('payments/status')
  async paymentStatus(
    @Req() req: Request,
    @Query('alumniId') alumniId?: string,
    @Query('paymentId') paymentId?: string,
    @Query('paymentToken') paymentToken?: string,
  ) {
    if (!alumniId || !paymentId || !paymentToken) {
      throw new BadRequestException(
        'alumniId, paymentId and paymentToken are required',
      );
    }
    const tenantId = await this.resolveTenantId(req);
    return this.alumniPayments.getPaymentStatus(
      tenantId,
      alumniId,
      paymentId,
      paymentToken,
    );
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @Post('payments/initiate')
  async initiatePayment(
    @Req() req: Request,
    @Body()
    body: {
      alumniId: string;
      paymentId: string;
      paymentToken: string;
      forceDemo?: boolean;
    },
  ) {
    if (!body?.alumniId || !body?.paymentId || !body?.paymentToken) {
      throw new BadRequestException(
        'alumniId, paymentId and paymentToken are required',
      );
    }
    const tenantId = await this.resolveTenantId(req);
    return this.alumniPayments.initiateCheckout(tenantId, body);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 900_000 } })
  @Post('payments/verify')
  async verifyPayment(
    @Req() req: Request,
    @Body()
    body: {
      alumniId: string;
      paymentId: string;
      paymentToken: string;
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    },
  ) {
    if (!body?.alumniId || !body?.paymentId || !body?.paymentToken) {
      throw new BadRequestException(
        'alumniId, paymentId and paymentToken are required',
      );
    }
    const tenantId = await this.resolveTenantId(req);
    return this.alumniPayments.verifyRazorpay(tenantId, body);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @Post('payments/confirm-mock')
  async confirmMockPayment(
    @Req() req: Request,
    @Body()
    body: { alumniId: string; paymentId: string; paymentToken: string },
  ) {
    if (!body?.alumniId || !body?.paymentId || !body?.paymentToken) {
      throw new BadRequestException(
        'alumniId, paymentId and paymentToken are required',
      );
    }
    const tenantId = await this.resolveTenantId(req);
    return this.alumniPayments.confirmMockOrReturn(tenantId, body);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 900_000 } })
  @Get('payments/receipt.pdf')
  async paymentReceiptPdf(
    @Req() req: Request,
    @Res() res: Response,
    @Query('alumniId') alumniId?: string,
    @Query('paymentId') paymentId?: string,
    @Query('paymentToken') paymentToken?: string,
  ) {
    if (!alumniId || !paymentId || !paymentToken) {
      throw new BadRequestException(
        'alumniId, paymentId and paymentToken are required',
      );
    }
    const tenantId = await this.resolveTenantId(req);
    const { buffer, filename } =
      await this.alumniDocuments.getPaymentReceiptPdf(tenantId, {
        alumniId,
        paymentId,
        paymentToken,
      });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${filename.replace(/"/g, '')}"`,
    );
    res.send(buffer);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 900_000 } })
  @Get('membership-card.pdf')
  async membershipCardPdf(
    @Req() req: Request,
    @Res() res: Response,
    @Query('alumniId') alumniId?: string,
    @Query('paymentId') paymentId?: string,
    @Query('paymentToken') paymentToken?: string,
  ) {
    if (!alumniId || !paymentId || !paymentToken) {
      throw new BadRequestException(
        'alumniId, paymentId and paymentToken are required',
      );
    }
    const tenantId = await this.resolveTenantId(req);
    // Validate token ownership via payment record, then issue card if active.
    await this.alumniPayments.getPaymentStatus(
      tenantId,
      alumniId,
      paymentId,
      paymentToken,
    );
    const { buffer, filename } =
      await this.alumniDocuments.getMembershipCardPdf(tenantId, alumniId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${filename.replace(/"/g, '')}"`,
    );
    res.send(buffer);
  }
}
