import { ForbiddenException } from '@nestjs/common';
import { SchoolSisAccessService } from './school-sis-access.service';
import type { JwtUser } from '../../common/decorators/current-user.decorator';

function user(partial: Partial<JwtUser>): JwtUser {
  return {
    sub: 'u1',
    tid: 't1',
    email: 'a@b.c',
    permissions: [],
    roles: [],
    ...partial,
  } as JwtUser;
}

describe('SchoolSisAccessService', () => {
  const access = new SchoolSisAccessService({} as never);

  it('denies by default', () => {
    expect(access.has(user({}), 'students.view')).toBe(false);
    expect(() => access.assert(user({}), 'students.view')).toThrow(
      ForbiddenException,
    );
  });

  it('allows school-sis:manage as a bypass', () => {
    expect(
      access.has(
        user({ permissions: ['school-sis:manage'] }),
        'fees.collection.collect',
      ),
    ).toBe(true);
  });

  it('allows an explicit permission', () => {
    expect(
      access.has(user({ permissions: ['students.view'] }), 'students.view'),
    ).toBe(true);
    expect(
      access.has(user({ permissions: ['students.view'] }), 'students.delete'),
    ).toBe(false);
  });

  it('treats college-admin as Super Admin', () => {
    expect(access.isSuper(user({ roles: ['college-admin'] }))).toBe(true);
    expect(access.isSuper(user({ roles: ['school-admin'] }))).toBe(false);
    expect(access.isSuper(user({ permissions: ['*'] }))).toBe(true);
  });
});
