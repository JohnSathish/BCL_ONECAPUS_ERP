import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ClsService } from 'nestjs-cls';
import { CLS_TENANT_ID } from '../../common/cls/cls.constants';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { TenantResolutionService } from '../tenants/tenant-resolution.service';
import {
  AppUpdatePolicyService,
  detectClientPlatform,
  parseAppUpdatePlatform,
  type AppUpdatePlatform,
} from './app-update-policy.service';
import {
  SaveAppUpdatePolicyDto,
  SendAppUpdateNotificationDto,
} from './dto/app-update.dto';

@ApiTags('app-updates')
@Controller({ path: 'app', version: ['1', VERSION_NEUTRAL] })
export class AppUpdateController {
  constructor(
    private readonly policies: AppUpdatePolicyService,
    private readonly cls: ClsService,
    private readonly tenantResolution: TenantResolutionService,
  ) {}

  private requirePlatform(raw: string): AppUpdatePlatform {
    const platform = parseAppUpdatePlatform(raw);
    if (!platform) {
      throw new BadRequestException('Platform must be android or ios');
    }
    return platform;
  }

  @Public()
  @Get('version')
  async version(
    @Headers('host') host: string,
    @Headers('x-tenant-slug') tenantSlug?: string,
    @Headers('x-platform') platformHeader?: string,
    @Headers('user-agent') userAgent?: string,
    @Query('platform') platformQuery?: string,
  ) {
    let tenantId = this.cls.get<string>(CLS_TENANT_ID);
    const slug = tenantSlug?.trim();
    if (!tenantId && slug) {
      tenantId = (await this.tenantResolution.resolveSlug(slug)).id;
    }
    if (!tenantId) {
      tenantId = (await this.tenantResolution.resolveHost(host)).id;
    }
    const platform =
      parseAppUpdatePlatform(platformQuery) ??
      detectClientPlatform(platformHeader, userAgent);
    return this.policies.getPublicPayload(tenantId, platform);
  }

  @Get('updates')
  @RequirePermissions('mobile:settings:read')
  list(@CurrentUser() user: JwtUser) {
    return this.policies.listForAdmin(user.tid);
  }

  @Put('updates/:platform')
  @RequirePermissions('mobile:settings:manage')
  save(
    @CurrentUser() user: JwtUser,
    @Param('platform') platform: string,
    @Body() dto: SaveAppUpdatePolicyDto,
  ) {
    return this.policies.save(user, this.requirePlatform(platform), dto);
  }

  @Post('updates/:platform/notify')
  @RequirePermissions('mobile:settings:manage')
  notify(
    @CurrentUser() user: JwtUser,
    @Param('platform') platform: string,
    @Body() dto: SendAppUpdateNotificationDto,
  ) {
    return this.policies.sendNotification(
      user,
      this.requirePlatform(platform),
      dto,
    );
  }
}
