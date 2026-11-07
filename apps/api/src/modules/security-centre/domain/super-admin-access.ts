import { isSuperAdmin } from '../../../common/permissions/permission-registry';

export function superAdminAccessDenial(
  user:
    | {
        roles?: string[];
        isImpersonating?: boolean;
      }
    | null
    | undefined,
): string | null {
  if (!user) return 'Authentication required';
  if (user.isImpersonating) {
    return 'Security Centre is unavailable during impersonation';
  }
  if (!isSuperAdmin(user.roles ?? [])) {
    return 'Security Centre is limited to super administrators';
  }
  return null;
}
