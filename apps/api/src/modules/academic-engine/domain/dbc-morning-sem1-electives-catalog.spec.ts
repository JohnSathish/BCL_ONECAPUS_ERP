import {
  MORNING_SEM1_AEC_CODES,
  MORNING_SEM1_MDC_CODES,
  MORNING_SEM1_SEC_CODES,
  MORNING_SEM1_VAC_CODES,
  DBC_MORNING_SEM1_COURSE_TITLES,
} from './dbc-morning-sem1-electives-catalog';

describe('dbc-morning-sem1-electives-catalog', () => {
  it('lists official Morning Shift Sem 1 MDC pool (4 choices)', () => {
    expect(MORNING_SEM1_MDC_CODES).toEqual([
      'MDC-111',
      'MDC-116',
      'MDC-118',
      'MDC-119',
    ]);
  });

  it('lists official Morning Shift Sem 1 AEC pool (2 choices)', () => {
    expect(MORNING_SEM1_AEC_CODES).toEqual(['AEC-120', 'AEC-123']);
  });

  it('lists official Morning Shift Sem 1 SEC pool (3 choices)', () => {
    expect(MORNING_SEM1_SEC_CODES).toEqual(['SEC-131', 'SEC-132', 'SEC-133']);
  });

  it('requires VAC-140 for Morning Sem 1', () => {
    expect(MORNING_SEM1_VAC_CODES).toEqual(['VAC-140']);
  });

  it('documents NEHU titles for Morning Sem 1 pool courses', () => {
    for (const code of [
      ...MORNING_SEM1_MDC_CODES,
      ...MORNING_SEM1_AEC_CODES,
      ...MORNING_SEM1_SEC_CODES,
      ...MORNING_SEM1_VAC_CODES,
    ]) {
      expect(DBC_MORNING_SEM1_COURSE_TITLES[code]).toBeTruthy();
    }
  });
});
