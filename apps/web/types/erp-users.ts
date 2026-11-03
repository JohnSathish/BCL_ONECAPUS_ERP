export type ErpUserStatus = 'active' | 'inactive' | 'locked' | string;

export type ErpUserRow = {
  id: string;
  accountCode: string;
  name: string;
  username: string | null;
  email: string;
  mobile: string | null;
  employeeId: string | null;
  department: { id: string; name: string; code: string } | null;
  designation: string | null;
  role: { id: string; slug: string; name: string } | null;
  isAdministrator: boolean;
  status: ErpUserStatus;
  pendingActivation: boolean;
  erpAccessEnabled: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  lockedAt: string | null;
  deactivatedAt: string | null;
  createdAt: string;
  createdBy: string | null;
};

export type ErpLoginEvent = {
  id: string;
  outcome: 'success' | 'failure' | 'lockout' | string;
  reason: string | null;
  method: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

export type ErpUserDetail = ErpUserRow & {
  extraPermissions: string[];
  deniedPermissionCount: number;
  liveSessions: {
    id: string;
    createdAt: string;
    expiresAt: string;
    ipAddress: string | null;
    userAgent: string | null;
  }[];
  recentLogins: ErpLoginEvent[];
  activity: {
    id: string;
    action: string;
    createdAt: string;
    actor: string | null;
    metadata: unknown;
  }[];
};

export type ErpUsersSummary = {
  total: number;
  active: number;
  inactive: number;
  locked: number;
  pendingActivation: number;
  administrators: number;
  signedIn: number;
};

export type ErpRoleOption = {
  slug: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissionCount: number;
  opensErp: boolean;
  isAdministrator: boolean;
  assignable: boolean;
};

export type ErpUsersOptions = {
  roles: ErpRoleOption[];
  departments: { id: string; name: string; code: string }[];
  designations: string[];
  permissions: {
    id: string;
    slug: string;
    resource: string;
    action: string;
    description: string | null;
  }[];
  actorIsSuperAdmin: boolean;
};

export type ErpUsersFilters = {
  search?: string;
  status?: string;
  role?: string;
  departmentId?: string;
  erpAccess?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  page?: number;
  limit?: number;
};

export type ErpUsersListResponse = {
  items: ErpUserRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type ErpUserFormPayload = {
  fullName: string;
  email: string;
  mobile?: string;
  employeeId?: string;
  departmentId?: string;
  designation?: string;
  username: string;
  password?: string;
  confirmPassword?: string;
  accountStatus?: 'active' | 'inactive';
  roleSlug: string;
  extraPermissions: string[];
  erpAccessEnabled: boolean;
  forcePasswordChange?: boolean;
};
