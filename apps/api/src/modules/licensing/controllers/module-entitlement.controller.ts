import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../../common/decorators/require-permissions.decorator';
import { ModuleEntitlementService } from '../services/module-entitlement.service';

@ApiBearerAuth()
@ApiTags('license')
@Controller({ path: 'license', version: '1' })
export class ModuleEntitlementController {
  constructor(private readonly entitlements: ModuleEntitlementService) {}

  @Get('modules')
  @RequireAnyPermission('license:read', 'license:activate', 'tenant:manage')
  listModules(@CurrentUser() user: JwtUser) {
    return this.entitlements.listForTenant(user.tid);
  }

  @Get('modules/enabled')
  @RequireAnyPermission('license:read', 'license:activate', 'tenant:manage')
  async listEnabled(@CurrentUser() user: JwtUser) {
    const keys = await this.entitlements.listEnabledKeys(user.tid);
    return { enabled: keys };
  }

  @Patch('modules/:moduleKey')
  @RequireAnyPermission('license:activate', 'tenant:manage')
  setEnabled(
    @CurrentUser() user: JwtUser,
    @Param('moduleKey') moduleKey: string,
    @Body() body: { enabled: boolean; limits?: Record<string, unknown> },
  ) {
    return this.entitlements.setEnabled(
      user.tid,
      moduleKey,
      Boolean(body.enabled),
      {
        limits: body.limits,
        updatedById: user.sub,
      },
    );
  }
}
