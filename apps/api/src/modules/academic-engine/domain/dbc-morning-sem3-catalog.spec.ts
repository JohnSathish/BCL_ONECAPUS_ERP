import {
  buildDbcMorningSem3VtcCourses,
  MORNING_SEM3_AEC_CODES,
  MORNING_SEM3_MDC_CODES,
  MORNING_SEM3_SEC_CODES,
  MORNING_SEM3_VTC_CODES,
  DBC_MORNING_SEM3_MDC_ELIGIBILITY,
} from './dbc-morning-sem3-catalog';

describe('dbc-morning-sem3-catalog', () => {
  it('documents Morning Shift Sem 3 pool codes', () => {
    expect([...MORNING_SEM3_MDC_CODES]).toEqual([
      'MDC-210',
      'MDC-211',
      'MDC-212',
      'MDC-213',
      'MDC-215',
    ]);
    expect([...MORNING_SEM3_AEC_CODES]).toEqual(['AEC-222']);
    expect([...MORNING_SEM3_SEC_CODES]).toEqual([
      'SEC-230',
      'SEC-232',
      'SEC-233',
    ]);
    expect([...MORNING_SEM3_VTC_CODES]).toEqual([
      'VTC-240.3',
      'VTC-241.2',
      'VTC-243.2',
      'VTC-243.3',
      'VTC-244.2',
      'VTC-245.3',
      'VTC-246.1',
      'VTC-248.1',
    ]);
  });

  it('documents Morning Sem 3 MDC eligibility rules', () => {
    expect(DBC_MORNING_SEM3_MDC_ELIGIBILITY['MDC-210']).toEqual({
      excludedMajorSubjectSlugs: ['english'],
    });
    expect(DBC_MORNING_SEM3_MDC_ELIGIBILITY['MDC-215']).toMatchObject({
      excludedMajorSubjectSlugs: ['education'],
    });
  });

  it('builds decimal-track VTC global courses without duplicate codes', () => {
    const courses = buildDbcMorningSem3VtcCourses();
    const codes = courses.map((course) => course.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(courses.some((course) => course.code === 'VTC-243.3')).toBe(true);
    expect(
      courses.every((course) => course.deliveryType === 'THEORY_PRACTICAL'),
    ).toBe(true);
    expect(courses.every((course) => course.credits === 4)).toBe(true);
  });
});
