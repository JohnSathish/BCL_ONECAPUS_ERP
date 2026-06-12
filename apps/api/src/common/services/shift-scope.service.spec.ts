import { ForbiddenException } from '@nestjs/common';
import { ShiftScopeService } from './shift-scope.service';
import type { JwtUser } from '../decorators/current-user.decorator';

describe('ShiftScopeService', () => {
  const service = new ShiftScopeService();

  const shiftAdmin: JwtUser = {
    sub: 'u1',
    tid: 't1',
    email: 'a@test.edu',
    roles: ['shift-admin'],
    permissions: ['shift:read'],
    shiftIds: ['shift-morning'],
    primaryShiftId: 'shift-morning',
    allShifts: false,
  };

  const collegeAdmin: JwtUser = {
    sub: 'u2',
    tid: 't1',
    email: 'admin@test.edu',
    roles: ['college-admin'],
    permissions: ['shift:manage'],
    allShifts: true,
  };

  it('blocks cross-shift access for shift admin', () => {
    const scope = service.resolveScope(shiftAdmin);
    expect(() => service.assertShiftAccess(scope, 'shift-day')).toThrow(
      ForbiddenException,
    );
  });

  it('allows college admin all shifts', () => {
    const scope = service.resolveScope(collegeAdmin);
    expect(() => service.assertShiftAccess(scope, 'shift-day')).not.toThrow();
  });

  it('applies primaryShiftId filter for shift admin list queries', () => {
    const scope = service.resolveScope(shiftAdmin);
    const where = service.applyPrimaryShiftWhere({ tenantId: 't1' }, scope);
    expect(where).toEqual({
      tenantId: 't1',
      primaryShiftId: { in: ['shift-morning'] },
    });
  });
});
