export type AuthUserPayload = {
  id: string;
  email: string;
  tenantId: string;
  tenantSlug: string;
  roles: string[];
  permissions: string[];
  shiftIds: string[];
  primaryShiftId?: string;
  allShifts: boolean;
  dataScope?: {
    departmentIds: string[];
    campusIds: string[];
    programmeIds: string[];
    semesterNos: number[];
    allDepartments: boolean;
    allCampuses: boolean;
  };
  impersonatedBy?: string;
  impersonationSessionId?: string;
  isImpersonating?: boolean;
};

export type AuthSessionResponse = {
  accessToken: string;
  expiresIn: number;
  expiresAt: string;
  user: AuthUserPayload;
  /** Plain refresh token — set HttpOnly cookie in controller; omit from JSON body */
  refreshToken: string;
  refreshMaxAgeSeconds: number;
};
