import {
  DAY_SEM4_VTC_CODES,
  DBC_SEM4_VTC_COURSE_TITLES,
  FYUGP_SEM4_VTC_CODES,
  MORNING_SEM4_VTC_CODES,
  buildDbcSem4VtcCourses,
} from './dbc-sem4-vtc-electives-catalog';

describe('dbc-sem4-vtc-electives-catalog', () => {
  it('lists official Sem 4 VTC pool (11 Stage-II choices, Day and Morning)', () => {
    expect(FYUGP_SEM4_VTC_CODES).toHaveLength(11);
    expect([...DAY_SEM4_VTC_CODES]).toEqual([...FYUGP_SEM4_VTC_CODES]);
    expect([...MORNING_SEM4_VTC_CODES]).toEqual([...FYUGP_SEM4_VTC_CODES]);
    // Stage-II codes (VTC-26x), not the Stage-I (VTC-24x) codes.
    expect(FYUGP_SEM4_VTC_CODES).toContain('VTC-263.2');
    expect(FYUGP_SEM4_VTC_CODES).not.toContain('VTC-243.2');
    // Traditional Music and Beauty Care are not offered in Sem 4.
    expect(FYUGP_SEM4_VTC_CODES).not.toContain('VTC-265.5');
    expect(FYUGP_SEM4_VTC_CODES).not.toContain('VTC-267.1');
  });

  it('documents stage-II titles for all Sem 4 VTC papers', () => {
    for (const code of FYUGP_SEM4_VTC_CODES) {
      expect(DBC_SEM4_VTC_COURSE_TITLES[code]).toBeTruthy();
    }
    expect(DBC_SEM4_VTC_COURSE_TITLES['VTC-263.2']).toBe(
      'Desktop Publishing – II',
    );
  });

  it('builds Sem 4 VTC courses tagged as stage 2 with the track group', () => {
    const courses = buildDbcSem4VtcCourses();
    expect(courses).toHaveLength(11);
    const dp = courses.find((c) => c.code === 'VTC-263.2');
    expect(dp?.semesterSequence).toBe(4);
    expect(dp?.vtcTrackStage).toBe(2);
    expect(dp?.vtcTrackGroupCode).toBe('DESKTOP_PUBLISHING');
    expect(dp?.deliveryType).toBe('THEORY_PRACTICAL');
  });
});
