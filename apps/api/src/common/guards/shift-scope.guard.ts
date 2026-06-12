import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SHIFT_SCOPED_KEY } from '../decorators/shift-scoped.decorator';
import type { JwtUser } from '../decorators/current-user.decorator';
import { buildShiftScope, type ShiftScope } from '../utils/shift-scope.util';

declare module 'express-serve-static-core' {
  interface Request {
    shiftScope?: ShiftScope;
  }
}

@Injectable()
export class ShiftScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const scoped = this.reflector.getAllAndOverride<boolean>(SHIFT_SCOPED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!scoped) return true;

    const request = context.switchToHttp().getRequest<{
      user?: JwtUser;
      headers: Record<string, string | string[] | undefined>;
      query: Record<string, string | string[] | undefined>;
      shiftScope?: ShiftScope;
    }>();

    const user = request.user;
    if (!user) throw new ForbiddenException('Authentication required');

    const headerShift = request.headers['x-shift-id'];
    const queryShift = request.query.shiftId;
    const requested =
      (typeof queryShift === 'string' ? queryShift : undefined) ??
      (typeof headerShift === 'string' ? headerShift : undefined);

    const scope = buildShiftScope(user, requested);

    if (!scope.allShifts && requested && scope.activeShiftId !== requested) {
      throw new ForbiddenException('Shift access denied');
    }

    request.shiftScope = scope;
    return true;
  }
}
