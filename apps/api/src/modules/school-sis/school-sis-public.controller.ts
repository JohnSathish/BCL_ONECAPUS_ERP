import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { TenantResolutionService } from '../tenants/tenant-resolution.service';
import { SubmitSchoolApplicationDto } from './dto/school-sis.dto';
import { SchoolSisAdmissionService } from './school-sis-admission.service';
import { SchoolSisPaymentGatewaysService } from './school-sis-payment-gateways.service';
import { SchoolSisService } from './school-sis.service';

@ApiTags('school-sis-public')
@Controller({ path: 'school-sis/public', version: '1' })
export class SchoolSisPublicController {
  constructor(
    private readonly tenants: TenantResolutionService,
    private readonly sis: SchoolSisService,
    private readonly admission: SchoolSisAdmissionService,
    private readonly gateways: SchoolSisPaymentGatewaysService,
  ) {}

  private async tenantId(host?: string) {
    const loginHost = host?.trim();
    if (!loginHost) throw new BadRequestException('Missing login host');
    const tenant = await this.tenants.resolveHost(loginHost);
    if (!tenant) throw new BadRequestException('Unknown school host');
    await this.sis.assertSecondarySisTenant(tenant.id);
    return tenant.id;
  }

  @Public()
  @Get('cycles')
  async cycles(
    @Headers('x-login-host') loginHost?: string,
    @Headers('x-forwarded-host') forwarded?: string,
  ) {
    const tenantId = await this.tenantId(loginHost || forwarded);
    return this.admission.listOpenCycles(tenantId);
  }

  @Public()
  @Post('applications')
  async apply(
    @Body() dto: SubmitSchoolApplicationDto,
    @Headers('x-login-host') loginHost?: string,
    @Headers('x-forwarded-host') forwarded?: string,
  ) {
    const tenantId = await this.tenantId(loginHost || forwarded);
    return this.admission.submitApplication(tenantId, dto);
  }

  @Public()
  @Post('payment-gateways/:id/webhook')
  async gatewayWebhook(
    @Param('id') id: string,
    @Req() req: Request & { rawBody?: Buffer },
    @Headers() headers: Record<string, string | undefined>,
  ) {
    const raw = req.rawBody?.toString('utf8') ?? JSON.stringify(req.body ?? {});
    return this.gateways.handleWebhook(id, raw, {
      'x-razorpay-signature': headers['x-razorpay-signature'],
      'x-webhook-signature': headers['x-webhook-signature'],
      'x-cashfree-signature': headers['x-cashfree-signature'],
      'x-webhook-timestamp': headers['x-webhook-timestamp'],
    });
  }
}
