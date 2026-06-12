export type AuthUser = {
  id: string;
  email: string;
  tenantId: string;
  tenantSlug: string;
  roles: string[];
  permissions?: string[];
  shiftIds?: string[];
  primaryShiftId?: string;
  allShifts?: boolean;
  impersonatedBy?: string;
  impersonationSessionId?: string;
  isImpersonating?: boolean;
};

export type AuthSession = {
  accessToken: string;
  expiresIn: number;
  expiresAt: string;
  user: AuthUser;
};

export type LoginPayload = {
  email: string;
  password: string;
  challengeToken: string;
  challengeAnswer: number;
  rememberMe?: boolean;
};
