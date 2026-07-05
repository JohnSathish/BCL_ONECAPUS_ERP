import {
  DAY_SEM1_AEC_CODES,
  DAY_SEM1_MDC_CODES,
  DAY_SEM1_SEC_CODES,
  DAY_SEM1_VAC_CODES,
  DBC_DAY_SEM1_COURSE_TITLES,
} from './dbc-day-sem1-electives-catalog';

describe('dbc-day-sem1-electives-catalog', () => {
  it('lists official Day Shift Sem 1 MDC pool (7 choices)', () => {
    expect(DAY_SEM1_MDC_CODES).toEqual([
      'MDC-111',
      'MDC-118',
      'MDC-119',
      'MDC-116',
      'MDC-112',
      'MDC-115',
      'MDC-110',
    ]);
  });

  it('lists official Day Shift Sem 1 AEC pool (2 choices)', () => {
    expect(DAY_SEM1_AEC_CODES).toEqual(['AEC-120', 'AEC-123']);
  });

  it('lists official Day Shift Sem 1 SEC pool (3 choices)', () => {
    expect(DAY_SEM1_SEC_CODES).toEqual(['SEC-131', 'SEC-132', 'SEC-133']);
  });

  it('requires VAC-140 for Day Sem 1', () => {
    expect(DAY_SEM1_VAC_CODES).toEqual(['VAC-140']);
  });

  it('documents NEHU titles for Day Sem 1 pool courses', () => {
    for (const code of [
      ...DAY_SEM1_MDC_CODES,
      ...DAY_SEM1_AEC_CODES,
      ...DAY_SEM1_SEC_CODES,
      ...DAY_SEM1_VAC_CODES,
    ]) {
      expect(DBC_DAY_SEM1_COURSE_TITLES[code]).toBeTruthy();
    }
    expect(DBC_DAY_SEM1_COURSE_TITLES['AEC-120']).toBe('Alternative English');
    expect(DBC_DAY_SEM1_COURSE_TITLES['AEC-123']).toBe('MIL-I: Garo');
    expect(DBC_DAY_SEM1_COURSE_TITLES['MDC-110']).toBe(
      'Commercial Arithmetic & Elementary Statistics',
    );
  });
});
