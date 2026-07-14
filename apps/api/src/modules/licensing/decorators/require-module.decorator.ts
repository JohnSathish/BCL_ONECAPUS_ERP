import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { ModuleEntitlementGuard } from '../guards/module-entitlement.guard';

export const REQUIRE_MODULE_KEY = 'requireModule';

/** Require a licensed/enabled tenant module (e.g. `@RequireModule('placement')`). */
export function RequireModule(moduleKey: string) {
  return applyDecorators(
    SetMetadata(REQUIRE_MODULE_KEY, moduleKey),
    UseGuards(ModuleEntitlementGuard),
  );
}
