import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
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
import { SchoolSisWhatsappWebhookService } from './school-sis-whatsapp-webhook.service';
import { SchoolSisAutomationService } from './school-sis-automation.service';
import { IncomingAutomationEventDto } from './dto/school-automation.dto';
import { SchoolSisIamService } from './school-sis-iam.service';
import { SchoolIamAcceptInviteDto } from './dto/school-iam.dto';

@ApiTags('school-sis-public')
@Controller({ path: 'school-sis/public', version: '1' })
export class SchoolSisPublicController {
  constructor(
    private readonly tenants: TenantResolutionService,
    private readonly sis: SchoolSisService,
    private readonly admission: SchoolSisAdmissionService,
    private readonly gateways: SchoolSisPaymentGatewaysService,
    private readonly whatsappWebhooks: SchoolSisWhatsappWebhookService,
    private readonly automation: SchoolSisAutomationService,
    private readonly iam: SchoolSisIamService,
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

  @Public()
  @Get('whatsapp/webhooks/meta')
  verifyWhatsapp(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    return this.whatsappWebhooks.verifyChallenge(mode, token, challenge);
  }

  @Public()
  @Post('whatsapp/webhooks/meta')
  async whatsappWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-hub-signature-256') signature?: string,
  ) {
    const raw = req.rawBody?.toString('utf8') ?? JSON.stringify(req.body ?? {});
    return this.whatsappWebhooks.handle(raw, signature);
  }

  @Public()
  @Post('automation/hooks/:token')
  incomingAutomation(
    @Param('token') token: string,
    @Body() dto: IncomingAutomationEventDto,
    @Req() req: Request,
  ) {
    const ip = req.ip;
    return this.automation.receiveIncoming(
      token,
      {
        event: dto.event,
        studentId: dto.studentId,
        entityId: dto.entityId,
        data: dto.data,
      },
      ip,
    );
  }

  @Public()
  @Post('iam/accept-invite')
  async acceptInvite(
    @Headers('x-login-host') loginHost?: string,
    @Headers('x-forwarded-host') forwarded?: string,
    @Body() dto?: SchoolIamAcceptInviteDto,
  ) {
    const tenantId = await this.tenantId(loginHost || forwarded);
    if (!dto?.token || !dto.password)
      throw new BadRequestException('Token and password required');
    return this.iam.acceptInvite(tenantId, dto.token, dto.password);
  }
}
