export type PortalUserRow = {
  id: string;
  email: string;
  username: string | null;
  name: string;
  mobile: string | null;
  displayName: string | null;
  roles: { id: string; slug: string; name: string }[];
  department: { id: string; name: string; code: string } | null;
  shift: { id: string; name: string; code: string } | null;
  programme: { name: string; code: string } | null;
  accountStatus: string;
  isActive: boolean;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  mustResetPassword: boolean;
  hasStudentProfile: boolean;
  hasFacultyProfile: boolean;
  createdAt: string;
};

export type UserSummary = {
  total: number;
  active: number;
  inactive: number;
  pending: number;
  suspended: number;
  blocked: number;
};

export type PortalUsersListResponse = {
  items: PortalUserRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type RoleRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissions: {
    id: string;
    slug: string;
    resource: string;
    action: string;
    description: string | null;
  }[];
};

export type PermissionRow = {
  id: string;
  slug: string;
  resource: string;
  action: string;
  description: string | null;
};

export type AuditLogRow = {
  id: string;
  userId: string | null;
  user: { id: string; email: string; displayName: string | null } | null;
  module: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type SecuritySettings = {
  id: string;
  minPasswordLength: number;
  passwordExpiryDays: number | null;
  passwordHistoryCount: number;
  forceResetOnFirstLogin: boolean;
  sessionTimeoutMinutes: number;
  mfaEnforced: boolean;
};

export type ActiveSessionRow = {
  id: string;
  userId: string;
  user: { id: string; email: string; displayName: string | null; username: string | null } | null;
  ipAddress: string | null;
  userAgent: string | null;
  device: string;
  browser: string;
  loginAt: string;
  expiresAt: string;
};

export type LookupTypeGroup = {
  category: string;
  types: { code: string; label: string }[];
};

export type MasterLookupRow = {
  id: string;
  lookupType: string;
  code: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
};

export type ImportModuleMeta = {
  id: string;
  label: string;
  description: string;
  validatePath: string;
  templatePath: string;
  available: boolean;
};

export type PortalUserFilters = {
  search?: string;
  role?: string;
  departmentId?: string;
  shiftId?: string;
  campusId?: string;
  status?: string;
  page?: number;
  limit?: number;
};
