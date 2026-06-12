import { ForbiddenException, Injectable } from '@nestjs/common';
import type { JwtUser } from '../decorators/current-user.decorator';
import {
  applyShiftWhere,
  buildShiftScope,
  type ShiftScope,
} from '../utils/shift-scope.util';

@Injectable()
export class ShiftScopeService {
  resolveScope(user: JwtUser, requestedShiftId?: string): ShiftScope {
    return buildShiftScope(user, requestedShiftId);
  }

  applyToWhere<T extends Record<string, unknown>>(
    where: T,
    scope: ShiftScope,
    field = 'shiftId',
  ): T {
    return applyShiftWhere(where, scope, field);
  }

  applyPrimaryShiftWhere<T extends Record<string, unknown>>(
    where: T,
    scope: ShiftScope,
  ): T {
    return applyShiftWhere(where, scope, 'primaryShiftId');
  }

  assertShiftAccess(scope: ShiftScope, shiftId: string | null | undefined) {
    if (!shiftId) return;
    if (scope.allShifts) return;
    const allowed = scope.activeShiftId
      ? [scope.activeShiftId]
      : scope.shiftIds;
    if (!allowed.includes(shiftId)) {
      throw new ForbiddenException('Shift access denied');
    }
  }

  assertCanUseShiftId(
    user: JwtUser,
    shiftId: string | undefined,
    requestedShiftId?: string,
  ): string | undefined {
    const scope = this.resolveScope(user, requestedShiftId ?? shiftId);
    if (shiftId) {
      this.assertShiftAccess(scope, shiftId);
      return shiftId;
    }
    if (!scope.allShifts && scope.activeShiftId) {
      return scope.activeShiftId;
    }
    return shiftId;
  }
}
