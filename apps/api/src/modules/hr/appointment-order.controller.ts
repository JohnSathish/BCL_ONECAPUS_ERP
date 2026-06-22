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
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import {
  AcceptAppointmentOrderDto,
  AppointmentOrderQueryDto,
  BulkGenerateAppointmentOrdersDto,
  CancelAppointmentOrderDto,
  CreateAppointmentOrderDto,
  PreviewSalaryDto,
  RejectAppointmentOrderDto,
  UpdateAppointmentOrderDto,
} from './dto/appointment-order.dto';
import { AppointmentOrderService } from './services/appointment-order.service';
import { AppointmentOrderTemplateService } from './services/appointment-order-template.service';

function auditFromReq(req: Request) {
  return {
    clientIp: req.ip,
    userAgent: req.headers['user-agent'],
  };
}

@ApiBearerAuth()
@ApiTags('hr-appointment-orders')
@Controller({ path: 'hr/appointment-orders', version: '1' })
export class AppointmentOrderController {
  constructor(
    private readonly orders: AppointmentOrderService,
    private readonly templates: AppointmentOrderTemplateService,
  ) {}

  @Get('dashboard')
  @RequireAnyPermission('hr:appointment:read', 'staff:manage', 'payroll:read')
  dashboard(@CurrentUser() user: JwtUser) {
    return this.orders.dashboard(user.tid);
  }

  @Get('templates')
  @RequireAnyPermission('hr:appointment:read', 'staff:manage', 'payroll:read')
  listTemplates(@CurrentUser() user: JwtUser) {
    return this.templates.list(user.tid);
  }

  @Post('templates/seed')
  @RequirePermissions('hr:appointment:manage')
  seedTemplates(@CurrentUser() user: JwtUser) {
    return this.templates.seedDefaults(user.tid);
  }

  @Get('candidates')
  @RequireAnyPermission('hr:appointment:read', 'staff:manage', 'payroll:read')
  listCandidates(
    @CurrentUser() user: JwtUser,
    @Query('search') search?: string,
  ) {
    return this.orders.listCandidates(user.tid, search);
  }

  @Get('candidates/:applicationId')
  @RequireAnyPermission('hr:appointment:read', 'staff:manage', 'payroll:read')
  getCandidate(
    @CurrentUser() user: JwtUser,
    @Param('applicationId') applicationId: string,
  ) {
    return this.orders.getCandidate(user.tid, applicationId);
  }

  @Post('preview-salary')
  @RequireAnyPermission(
    'hr:appointment:manage',
    'staff:manage',
    'payroll:manage',
  )
  previewSalary(@CurrentUser() user: JwtUser, @Body() dto: PreviewSalaryDto) {
    return this.orders.previewSalary(
      user.tid,
      dto.payStructureTemplateId,
      dto.basicPay,
    );
  }

  @Get()
  @RequireAnyPermission('hr:appointment:read', 'staff:manage', 'payroll:read')
  list(@CurrentUser() user: JwtUser, @Query() query: AppointmentOrderQueryDto) {
    return this.orders.list(user.tid, query);
  }

  @Get(':id')
  @RequireAnyPermission('hr:appointment:read', 'staff:manage', 'payroll:read')
  get(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.orders.get(user.tid, id);
  }

  @Post()
  @RequireAnyPermission('hr:appointment:manage', 'staff:manage')
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateAppointmentOrderDto) {
    return this.orders.create(user, dto);
  }

  @Patch(':id')
  @RequireAnyPermission('hr:appointment:manage', 'staff:manage')
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentOrderDto,
  ) {
    return this.orders.update(user, id, dto);
  }

  @Post(':id/generate')
  @RequireAnyPermission('hr:appointment:issue', 'staff:manage')
  generate(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.orders.generate(user, id, auditFromReq(req));
  }

  @Get(':id/preview')
  @RequireAnyPermission('hr:appointment:read', 'staff:manage', 'payroll:read')
  async preview(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    const order = await this.orders.get(user.tid, id);
    return { html: order.renderedHtml };
  }

  @Get(':id/pdf')
  @RequireAnyPermission('hr:appointment:read', 'staff:manage', 'payroll:read')
  async pdf(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.orders.getPdf(user.tid, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Post(':id/send')
  @RequireAnyPermission('hr:appointment:manage', 'staff:manage')
  send(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.orders.send(user, id, auditFromReq(req));
  }

  @Post(':id/accept')
  @RequireAnyPermission('hr:appointment:manage', 'staff:manage')
  accept(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: AcceptAppointmentOrderDto,
    @Req() req: Request,
  ) {
    return this.orders.accept(user, id, dto, auditFromReq(req));
  }

  @Post(':id/reject')
  @RequireAnyPermission('hr:appointment:manage', 'staff:manage')
  reject(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: RejectAppointmentOrderDto,
    @Req() req: Request,
  ) {
    return this.orders.reject(user, id, dto, auditFromReq(req));
  }

  @Post(':id/cancel')
  @RequireAnyPermission('hr:appointment:manage', 'staff:manage')
  cancel(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: CancelAppointmentOrderDto,
    @Req() req: Request,
  ) {
    return this.orders.cancel(user, id, dto, auditFromReq(req));
  }

  @Post(':id/reissue')
  @RequireAnyPermission('hr:appointment:issue', 'staff:manage')
  reissue(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.orders.reissue(user, id);
  }

  @Post('bulk-generate')
  @RequireAnyPermission('hr:appointment:issue', 'staff:manage')
  async bulkGenerate(
    @CurrentUser() user: JwtUser,
    @Body() dto: BulkGenerateAppointmentOrdersDto,
    @Req() req: Request,
  ) {
    const results = [];
    for (const applicationId of dto.applicationIds) {
      const draft = await this.orders.create(user, {
        applicationId,
        appointmentType: 'PROBATIONARY',
        staffType: 'TEACHING',
      });
      const generated = await this.orders.generate(
        user,
        draft.id,
        auditFromReq(req),
      );
      results.push(generated);
    }
    return { generated: results.length, orders: results };
  }
}
