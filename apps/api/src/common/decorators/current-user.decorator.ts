import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type JwtUser = {
  sub: string;
  tid: string;
  email: string;
  roles: string[];
  permissions: string[];
  shiftIds?: string[];
  primaryShiftId?: string;
  allShifts?: boolean;
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

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUser => {
    const request = ctx.switchToHttp().getRequest<{ user: JwtUser }>();
    return request.user;
  },
);
