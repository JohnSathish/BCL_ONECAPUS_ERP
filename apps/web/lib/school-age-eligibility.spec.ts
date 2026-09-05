import { describe, expect, it } from 'vitest';
import {
  eligibleDobIsoRange,
  evaluateSchoolAgeEligibility,
  parseDateOnly,
  SCHOOL_AGE_INELIGIBLE_MESSAGE,
} from './school-age-eligibility';

describe('school KG 2027 age eligibility', () => {
  const census = '2027-01-01';

  it('keeps the approved inclusive window', () => {
    expect(eligibleDobIsoRange(census)).toEqual({
      minDob: '2021-01-02',
      maxDob: '2022-01-01',
    });
  });

  it.each(['2022-01-01', '2021-12-31', '2021-01-02'])('allows %s', (dob) => {
    expect(evaluateSchoolAgeEligibility(dob, census).eligible).toBe(true);
  });

  it.each(['2021-01-01', '2020-12-31', '2022-01-02'])('blocks %s', (dob) => {
    const result = evaluateSchoolAgeEligibility(dob, census);
    expect(result.eligible).toBe(false);
    expect(result.message).toBe(SCHOOL_AGE_INELIGIBLE_MESSAGE);
  });

  it('rejects impossible calendar dates', () => {
    expect(parseDateOnly('2021-02-29')).toBeNull();
    expect(evaluateSchoolAgeEligibility('2021-02-29', census).eligible).toBe(false);
  });
});
