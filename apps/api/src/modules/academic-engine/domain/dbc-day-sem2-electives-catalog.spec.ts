import {
  DAY_SEM2_AEC_CODES,
  DAY_SEM2_MDC_CODES,
  DAY_SEM2_SEC_CODES,
  DAY_SEM2_VAC_CODES,
  DBC_DAY_SEM2_COURSE_TITLES,
} from './dbc-day-sem2-electives-catalog';

describe('dbc-day-sem2-electives-catalog', () => {
  it('lists official Day Shift Sem 2 MDC pool (8 choices)', () => {
    expect(DAY_SEM2_MDC_CODES).toEqual([
      'MDC-161',
      'MDC-162',
      'MDC-163',
      'MDC-164',
      'MDC-165',
      'MDC-167',
      'MDC-168',
      'MDC-169',
    ]);
  });

  it('lists official Day Shift Sem 2 AEC pool (2 choices)', () => {
    expect(DAY_SEM2_AEC_CODES).toEqual(['AEC-170', 'AEC-173']);
  });

  it('lists official Day Shift Sem 2 SEC pool (4 choices)', () => {
    expect(DAY_SEM2_SEC_CODES).toEqual([
      'SEC-180',
      'SEC-181',
      'SEC-182',
      'SEC-183',
    ]);
  });

  it('lists official Day Shift Sem 2 VAC pool (3 choices)', () => {
    expect(DAY_SEM2_VAC_CODES).toEqual(['VAC-190', 'VAC-191', 'VAC-192']);
  });

  it('documents NEHU titles for all Day Sem 2 pool courses', () => {
    for (const code of [
      ...DAY_SEM2_MDC_CODES,
      ...DAY_SEM2_AEC_CODES,
      ...DAY_SEM2_SEC_CODES,
      ...DAY_SEM2_VAC_CODES,
    ]) {
      expect(DBC_DAY_SEM2_COURSE_TITLES[code]).toBeTruthy();
    }
  });
});
