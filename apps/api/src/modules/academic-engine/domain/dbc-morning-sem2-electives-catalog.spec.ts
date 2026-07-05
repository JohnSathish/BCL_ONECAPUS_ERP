import {
  MORNING_SEM2_AEC_CODES,
  MORNING_SEM2_MDC_CODES,
  MORNING_SEM2_SEC_CODES,
  MORNING_SEM2_VAC_CODES,
  DBC_MORNING_SEM2_COURSE_TITLES,
} from './dbc-morning-sem2-electives-catalog';

describe('dbc-morning-sem2-electives-catalog', () => {
  it('lists official Morning Shift Sem 2 MDC pool (5 choices)', () => {
    expect(MORNING_SEM2_MDC_CODES).toEqual([
      'MDC-162',
      'MDC-163',
      'MDC-165',
      'MDC-168',
      'MDC-169',
    ]);
  });

  it('lists official Morning Shift Sem 2 AEC pool (2 choices)', () => {
    expect(MORNING_SEM2_AEC_CODES).toEqual(['AEC-170', 'AEC-173']);
  });

  it('lists official Morning Shift Sem 2 SEC pool (2 choices)', () => {
    expect(MORNING_SEM2_SEC_CODES).toEqual(['SEC-180', 'SEC-181']);
  });

  it('lists official Morning Shift Sem 2 VAC pool (2 choices)', () => {
    expect(MORNING_SEM2_VAC_CODES).toEqual(['VAC-191', 'VAC-192']);
  });

  it('documents NEHU titles for all Morning Sem 2 pool courses', () => {
    for (const code of [
      ...MORNING_SEM2_MDC_CODES,
      ...MORNING_SEM2_AEC_CODES,
      ...MORNING_SEM2_SEC_CODES,
      ...MORNING_SEM2_VAC_CODES,
    ]) {
      expect(DBC_MORNING_SEM2_COURSE_TITLES[code]).toBeTruthy();
    }
  });
});
