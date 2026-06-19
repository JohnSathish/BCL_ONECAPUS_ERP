import { buildShiftScope, NIL_UUID, shiftFilter } from './shift-scope.util';
import type { JwtUser } from '../decorators/current-user.decorator';

describe('shift-scope.util', () => {
  const scopedUser: JwtUser = {
    sub: 'u1',
    tid: 't1',
    email: 'shift@test.edu',
    roles: ['shift-admin'],
    permissions: [],
    shiftIds: ['11111111-1111-1111-1111-111111111111'],
    primaryShiftId: '11111111-1111-1111-1111-111111111111',
    allShifts: false,
  };

  it('uses a valid nil UUID when no shifts are assigned', () => {
    const scope = buildShiftScope({
      sub: 'u2',
      tid: 't1',
      email: 'none@test.edu',
      roles: ['staff'],
      permissions: [],
      shiftIds: [],
      allShifts: false,
    });
    expect(shiftFilter(scope, 'primaryShiftId')).toEqual({
      primaryShiftId: { in: [NIL_UUID] },
    });
  });

  it('does not filter when all shifts are allowed', () => {
    const scope = buildShiftScope({
      sub: 'u3',
      tid: 't1',
      email: 'admin@test.edu',
      roles: ['super-admin'],
      permissions: [],
      allShifts: true,
    });
    expect(shiftFilter(scope, 'primaryShiftId')).toBeUndefined();
  });

  it('filters to the active shift for scoped users', () => {
    const scope = buildShiftScope(scopedUser);
    expect(shiftFilter(scope, 'primaryShiftId')).toEqual({
      primaryShiftId: {
        in: ['11111111-1111-1111-1111-111111111111'],
      },
    });
  });
});
