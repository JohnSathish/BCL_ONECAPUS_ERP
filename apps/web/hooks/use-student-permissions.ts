import { useMemo } from 'react';
import { useAuthStore } from '@/store/auth-store';

const ADMIN_ROLES = ['college-admin', 'super-admin', 'university-admin'];

export function useStudentPermissions() {
  const session = useAuthStore((s) => s.session);
  return useMemo(() => {
    const perms = session?.user.permissions ?? [];
    const roles = session?.user.roles ?? [];
    const isAdmin = roles.some((r) => ADMIN_ROLES.includes(r));
    const has = (p: string) => perms.includes(p) || isAdmin;
    return {
      canRead: has('students:read'),
      canManage: has('students:manage'),
      canManageAcademic: has('students:manage-academic'),
      canImport: has('students:import'),
      canExport: has('students:export'),
      canVerifyDocuments: has('students:verify-documents'),
      canBulkUpdate: has('students:bulk-update') || has('students:manage'),
      canBulkUpdatePersonal:
        has('students:bulk-update:personal') ||
        has('students:bulk-update') ||
        has('students:manage'),
      canBulkUpdateAcademic:
        has('students:bulk-update:academic') ||
        has('students:bulk-update') ||
        has('students:manage'),
      canBulkUpdateSubjects:
        has('students:bulk-update:subjects') ||
        has('students:bulk-update') ||
        has('students:manage'),
      canBulkUpdateRollback: has('students:bulk-update:rollback') || isAdmin,
      canManagePhotos: has('students:photos:upload') || has('students:manage'),
      canReplacePhotos: has('students:photos:replace') || has('students:manage'),
      canDeletePhotos: has('students:photos:delete') || isAdmin,
      canDownloadPhotoReports: has('students:photos:reports') || has('students:manage'),
    };
  }, [session]);
}
