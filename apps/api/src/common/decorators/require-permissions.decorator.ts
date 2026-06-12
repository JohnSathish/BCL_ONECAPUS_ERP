import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSIONS_KEY = 'requirePermissions';
export const REQUIRE_ANY_PERMISSION_KEY = 'requireAnyPermission';

/** User must have all listed permission slugs. */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(REQUIRE_PERMISSIONS_KEY, permissions);

/** User must have at least one listed permission slug. */
export const RequireAnyPermission = (...permissions: string[]) =>
  SetMetadata(REQUIRE_ANY_PERMISSION_KEY, permissions);
