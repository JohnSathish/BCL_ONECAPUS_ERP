import {
  DAY_SEM4_VTC_CODES,
  DBC_SEM4_VTC_COURSE_TITLES,
  FYUGP_SEM4_VTC_CODES,
  MORNING_SEM4_VTC_CODES,
} from './dbc-sem4-vtc-electives-catalog';

describe('dbc-sem4-vtc-electives-catalog', () => {
  it('lists official Sem 4 VTC pool (11 choices, Day and Morning)', () => {
    expect(FYUGP_SEM4_VTC_CODES).toHaveLength(11);
    expect([...DAY_SEM4_VTC_CODES]).toEqual([...FYUGP_SEM4_VTC_CODES]);
    expect([...MORNING_SEM4_VTC_CODES]).toEqual([...FYUGP_SEM4_VTC_CODES]);
    expect(FYUGP_SEM4_VTC_CODES).toContain('VTC-240.3');
    expect(FYUGP_SEM4_VTC_CODES).not.toContain('VTC-245.5');
  });

  it('documents stage-II titles for all Sem 4 VTC papers', () => {
    for (const code of FYUGP_SEM4_VTC_CODES) {
      expect(DBC_SEM4_VTC_COURSE_TITLES[code]).toBeTruthy();
    }
    expect(DBC_SEM4_VTC_COURSE_TITLES['VTC-240.3']).toBe('Bee Keeping – II');
  });
});
