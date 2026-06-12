import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../../common/decorators/current-user.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../../common/decorators/require-permissions.decorator';
import {
  CreateLicenseDto,
  ExtendLicenseDto,
  ListLicensesQueryDto,
  RenewLicenseDto,
  SuspendLicenseDto,
} from '../dto/licensing.dto';
import { PlatformLicenseService } from '../services/platform-license.service';

@ApiBearerAuth()
@ApiTags('platform-licenses')
@Controller({ path: 'platform/licenses', version: '1' })
export class PlatformLicenseController {
  constructor(private readonly platform: PlatformLicenseService) {}

  @Get()
  @RequireAnyPermission('platform:licenses:read', 'platform:licenses:manage')
  list(@Query() query: ListLicensesQueryDto) {
    return this.platform.list(query);
  }

  @Get('analytics')
  @RequireAnyPermission('platform:licenses:read', 'platform:licenses:manage')
  analytics() {
    return this.platform.analytics();
  }

  @Get(':tenantId')
  @RequireAnyPermission('platform:licenses:read', 'platform:licenses:manage')
  getOne(@Param('tenantId') tenantId: string) {
    return this.platform.getByTenantId(tenantId);
  }

  @Get(':tenantId/audit')
  @RequireAnyPermission('platform:licenses:read', 'platform:licenses:manage')
  audit(@Param('tenantId') tenantId: string) {
    return this.platform.auditTrail(tenantId);
  }

  @Post()
  @RequirePermissions('platform:licenses:manage')
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateLicenseDto) {
    return this.platform.create(dto, user);
  }

  @Post(':tenantId/renew')
  @RequirePermissions('platform:licenses:manage')
  renew(
    @CurrentUser() user: JwtUser,
    @Param('tenantId') tenantId: string,
    @Body() dto: RenewLicenseDto,
  ) {
    return this.platform.renew(tenantId, dto, user);
  }

  @Post(':tenantId/extend')
  @RequirePermissions('platform:licenses:manage')
  extend(
    @CurrentUser() user: JwtUser,
    @Param('tenantId') tenantId: string,
    @Body() dto: ExtendLicenseDto,
  ) {
    return this.platform.extend(tenantId, dto, user);
  }

  @Post(':tenantId/suspend')
  @RequirePermissions('platform:licenses:manage')
  suspend(
    @CurrentUser() user: JwtUser,
    @Param('tenantId') tenantId: string,
    @Body() dto: SuspendLicenseDto,
  ) {
    return this.platform.suspend(tenantId, dto, user);
  }

  @Post(':tenantId/activate')
  @RequirePermissions('platform:licenses:manage')
  activate(@CurrentUser() user: JwtUser, @Param('tenantId') tenantId: string) {
    return this.platform.activate(tenantId, user);
  }
}
