import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import {
  PatchSchoolPaymentGatewayDto,
  SaveSchoolPaymentGatewayDto,
} from './dto/school-sis.dto';
import {
  SCHOOL_SIS_PERMISSION_MANAGE,
  SCHOOL_SIS_PERMISSION_READ,
} from './school-sis.constants';
import {
  SchoolSisPaymentGatewaysService,
  type GatewayActor,
} from './school-sis-payment-gateways.service';

function gatewayActor(user: JwtUser, req?: Request): GatewayActor {
  const perms = user.permissions ?? [];
  const roles = (user.roles ?? []).join(' ').toLowerCase();
  const manage =
    perms.includes('*') || perms.includes(SCHOOL_SIS_PERMISSION_MANAGE);
  const cashierOnly =
    /cashier/.test(roles) && !/admin|principal|super/.test(roles);
  const accountant = /accountant|accounts/.test(roles);
  const access: GatewayActor['access'] = cashierOnly
    ? 'none'
    : manage
      ? 'configure'
      : accountant || perms.includes(SCHOOL_SIS_PERMISSION_READ)
        ? 'view'
        : 'none';
  return {
    userId: user.sub,
    access,
    ip:
      (req?.headers['x-forwarded-for'] as string | undefined)
        ?.split(',')[0]
        ?.trim() || req?.ip,
    userAgent: req?.headers['user-agent'],
  };
}

@ApiBearerAuth()
@ApiTags('school-sis-payment-gateways')
@Controller({ path: 'school-sis/fees/payment-gateways', version: '1' })
export class SchoolSisPaymentGatewaysController {
  constructor(private readonly gateways: SchoolSisPaymentGatewaysService) {}

  @Get()
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  list(@CurrentUser() user: JwtUser, @Req() req: Request) {
    return this.gateways.dashboard(user.tid, gatewayActor(user, req));
  }

  @Post()
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  create(
    @CurrentUser() user: JwtUser,
    @Body() dto: SaveSchoolPaymentGatewayDto,
    @Req() req: Request,
  ) {
    return this.gateways.create(user.tid, dto, gatewayActor(user, req));
  }

  @Get('transactions')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  transactions(
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('gatewayId') gatewayId?: string,
    @Query('status') status?: string,
    @Query('student') student?: string,
    @Query('classId') classId?: string,
    @Query('q') q?: string,
  ) {
    return this.gateways.listTransactions(user.tid, gatewayActor(user, req), {
      from,
      to,
      gatewayId,
      status,
      student,
      classId,
      q,
    });
  }

  @Get(':id')
  @RequireAnyPermission(
    SCHOOL_SIS_PERMISSION_READ,
    SCHOOL_SIS_PERMISSION_MANAGE,
  )
  one(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Query('reveal') reveal?: string,
    @Req() req?: Request,
  ) {
    return this.gateways.getOne(
      user.tid,
      id,
      gatewayActor(user, req),
      reveal === '1' || reveal === 'true',
    );
  }

  @Patch(':id')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: PatchSchoolPaymentGatewayDto,
    @Req() req: Request,
  ) {
    return this.gateways.update(user.tid, id, dto, gatewayActor(user, req));
  }

  @Delete(':id')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  remove(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.gateways.remove(user.tid, id, gatewayActor(user, req));
  }

  @Post(':id/test-connection')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  test(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.gateways.testConnection(user.tid, id, gatewayActor(user, req));
  }

  @Post(':id/set-default')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  setDefault(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.gateways.setDefault(user.tid, id, gatewayActor(user, req));
  }

  @Post(':id/activate')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  activate(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.gateways.activate(user.tid, id, gatewayActor(user, req));
  }

  @Post(':id/deactivate')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  deactivate(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.gateways.deactivate(user.tid, id, gatewayActor(user, req));
  }
}
