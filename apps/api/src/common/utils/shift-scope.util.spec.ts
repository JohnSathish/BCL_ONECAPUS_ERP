import {
  buildShiftScope,
  NIL_UUID,
  optionalUuid,
  parseTimeToDate,
  shiftFilter,
} from './shift-scope.util';
import type { JwtUser } from '../decorators/current-user.decorator';

describe('shift-scope.util', () => {
  it('parses HH:mm, HH:mm:ss, and ISO clock times', () => {
    expect(parseTimeToDate('09:45').toISOString()).toBe(
      '1970-01-01T09:45:00.000Z',
    );
    expect(parseTimeToDate('09:45:30').toISOString()).toBe(
      '1970-01-01T09:45:30.000Z',
    );
    expect(parseTimeToDate('1970-01-01T10:40:00.000Z').toISOString()).toBe(
      '1970-01-01T10:40:00.000Z',
    );
  });

  it('rejects empty / synthetic ids for UUID columns', () => {
    expect(optionalUuid('')).toBeNull();
    expect(
      optionalUuid('entry-0af75f2a-18d5-4869-9cd7-3575676ca51a'),
    ).toBeNull();
    expect(
      optionalUuid('synthetic-0af75f2a-18d5-4869-9cd7-3575676ca51a'),
    ).toBeNull();
    expect(optionalUuid('0af75f2a-18d5-4869-9cd7-3575676ca51a')).toBe(
      '0af75f2a-18d5-4869-9cd7-3575676ca51a',
    );
  });

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
