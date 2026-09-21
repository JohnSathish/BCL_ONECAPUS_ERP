import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import type { JwtUser } from '../../common/decorators/current-user.decorator';

const ALLOWED = [
  /\/school-mobile\/change-password\/?$/i,
  /\/school-mobile\/auth\/refresh\/?$/i,
  /\/school-mobile\/auth\/logout\/?$/i,
  /\/school-mobile\/auth\/logout-all\/?$/i,
  /\/school-mobile\/auth\/sessions\/revoke-all\/?$/i,
];

export function schoolMobilePasswordResetAllowed(
  url: string,
  mustResetPassword?: boolean,
) {
  if (!mustResetPassword) return true;
  const path = url.split('?')[0];
  return ALLOWED.some((pattern) => pattern.test(path));
}

@Injectable()
export class SchoolMobilePasswordResetGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtUser }>();
    const user = req.user;
    if (!user?.mustResetPassword) return true;
    const url = String(req.originalUrl || req.url || req.path || '');
    if (schoolMobilePasswordResetAllowed(url, true)) return true;
    throw new ForbiddenException('PASSWORD_RESET_REQUIRED');
  }
}
