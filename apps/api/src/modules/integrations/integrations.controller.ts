import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import { RequireModule } from '../licensing/decorators/require-module.decorator';
import { IntegrationsService } from './services/integrations.service';

@ApiBearerAuth()
@ApiTags('integrations')
@RequireModule('integrations')
@Controller({ path: 'integrations', version: '1' })
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Get('connectors')
  @RequireAnyPermission('integrations:read', 'integrations:manage')
  list(@CurrentUser() user: JwtUser) {
    return this.integrations.listConnectors(user.tid);
  }

  @Put('connectors')
  @RequirePermissions('integrations:manage')
  upsert(
    @CurrentUser() user: JwtUser,
    @Body()
    body: {
      provider: string;
      displayName?: string;
      enabled?: boolean;
      config?: Record<string, unknown>;
    },
  ) {
    return this.integrations.upsertConnector(user, body);
  }

  @Get('sso/oidc-config')
  @RequireAnyPermission('integrations:read', 'integrations:manage')
  getOidc(@CurrentUser() user: JwtUser) {
    return this.integrations.getOidcConfig(user.tid);
  }

  @Post('sso/oidc-config')
  @RequirePermissions('integrations:manage')
  setOidc(
    @CurrentUser() user: JwtUser,
    @Body()
    body: {
      issuer: string;
      clientId: string;
      clientSecret?: string;
      redirectUri: string;
      enabled?: boolean;
    },
  ) {
    return this.integrations.setOidcConfig(user, body);
  }
}
