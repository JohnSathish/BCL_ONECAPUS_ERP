import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { JwtUser } from '../decorators/current-user.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { Reflector } from '@nestjs/core';
import {
  isRestrictedLibraryStaff,
  restrictedStaffMayMutate,
} from '../permissions/library-qp-readonly';

@Injectable()
export class RestrictedStaffWriteGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{
      user?: JwtUser;
      method?: string;
      originalUrl?: string;
      url?: string;
    }>();
    if (!isRestrictedLibraryStaff(request.user?.roles, request.user?.email))
      return true;

    const path = request.originalUrl || request.url || '';
    if (restrictedStaffMayMutate(request.method ?? 'GET', path)) return true;

    throw new ForbiddenException(
      'This account can change the library and the question paper repository only.',
    );
  }
}
