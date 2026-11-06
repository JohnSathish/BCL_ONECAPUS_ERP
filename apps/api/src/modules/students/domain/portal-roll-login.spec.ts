import { portalLoginAfterRollChange } from './portal-roll-login';

describe('portal login after a roll change', () => {
  it('moves the login and admission number onto the new roll', () => {
    expect(
      portalLoginAfterRollChange({
        oldRoll: 'EC26-20',
        newRoll: 'EC26-128',
        username: 'EC26-20',
        enrollmentNumber: 'EC26-20',
      }),
    ).toEqual({ username: 'EC26-128', enrollmentNumber: 'EC26-128' });
  });

  it('leaves a login that was never the old roll', () => {
    expect(
      portalLoginAfterRollChange({
        oldRoll: 'EC26-20',
        newRoll: 'EC26-128',
        username: 'disram',
        enrollmentNumber: 'APP-1738',
      }),
    ).toEqual({ username: null, enrollmentNumber: null });
  });
});
