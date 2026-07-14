import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { REQUIRE_MODULE_KEY } from '../decorators/require-module.decorator';
import { ModuleEntitlementService } from '../services/module-entitlement.service';

@Injectable()
export class ModuleEntitlementGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlements: ModuleEntitlementService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const moduleKey = this.reflector.getAllAndOverride<string>(
      REQUIRE_MODULE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!moduleKey) return true;

    const request = context.switchToHttp().getRequest<{ user?: JwtUser }>();
    const user = request.user;
    if (!user?.tid) return false;

    await this.entitlements.assertEnabled(user.tid, moduleKey);
    return true;
  }
}
