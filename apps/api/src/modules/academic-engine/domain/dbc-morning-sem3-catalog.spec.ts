import {
  buildDbcMorningSem3VtcCourses,
  MORNING_SEM3_AEC_CODES,
  MORNING_SEM3_MDC_CODES,
  MORNING_SEM3_SEC_CODES,
  MORNING_SEM3_VTC_CODES,
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
    expect([...MORNING_SEM3_VTC_CODES]).toContain('VTC-240.3');
    expect([...MORNING_SEM3_VTC_CODES]).toHaveLength(8);
  });

  it('builds decimal-track VTC global courses without duplicate codes', () => {
    const courses = buildDbcMorningSem3VtcCourses();
    const codes = courses.map((course) => course.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(courses.some((course) => course.code === 'VTC-243.3')).toBe(true);
  });
});
