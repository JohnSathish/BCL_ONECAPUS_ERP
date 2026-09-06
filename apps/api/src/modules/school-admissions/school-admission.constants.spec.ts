import {
  ageAsOf,
  eligibleDobIsoRange,
  evaluateSchoolAdmissionWindow,
  evaluateSchoolAgeEligibility,
  getSchoolFormGaps,
  parseDateOnly,
  SCHOOL_AGE_INELIGIBLE_MESSAGE,
  schoolAgeIneligibleMessage,
  schoolMaxOnlineApplications,
} from './school-admission.constants';

describe('school admission age rules', () => {
  const census = '2027-01-01';

  it('computes age on the census date using UTC calendar dates', () => {
    const dob = parseDateOnly('2021-06-15')!;
    const asOf = parseDateOnly(census)!;
    expect(ageAsOf(dob, asOf)).toEqual({
      years: 5,
      months: 6,
      days: 17,
    });
  });

  it('uses the inclusive eligible DOB window 02 Jan 2021 to 01 Jan 2022', () => {
    expect(eligibleDobIsoRange(census)).toEqual({
      minDob: '2021-01-02',
      maxDob: '2022-01-01',
    });
  });

  it('uses the approved ineligible message for the 2027 KG census', () => {
    expect(schoolAgeIneligibleMessage(census)).toBe(
      SCHOOL_AGE_INELIGIBLE_MESSAGE,
    );
  });

  it.each([
    ['2022-01-01', true],
    ['2021-12-31', true],
    ['2021-01-02', true],
    ['2021-06-15', true],
  ])('treats %s as eligible', (dob, expected) => {
    const result = evaluateSchoolAgeEligibility(dob, census);
    expect(result.eligible).toBe(expected);
    expect(result.age).not.toBeNull();
  });

  it('accepts a child who turns exactly 5 on census day', () => {
    const result = evaluateSchoolAgeEligibility('2022-01-01', census);
    expect(result.eligible).toBe(true);
    expect(result.age).toEqual({ years: 5, months: 0, days: 0 });
  });

  it.each([['2021-01-01'], ['2020-12-31'], ['2022-01-02'], ['2020-02-29']])(
    'treats %s as not eligible',
    (dob) => {
      const result = evaluateSchoolAgeEligibility(dob, census);
      expect(result.eligible).toBe(false);
      expect(result.message).toBe(SCHOOL_AGE_INELIGIBLE_MESSAGE);
    },
  );

  it('rejects an invalid calendar date', () => {
    const result = evaluateSchoolAgeEligibility('2021-02-29', census);
    expect(result.eligible).toBe(false);
    expect(result.message).toBe('Enter a valid date of birth.');
  });

  it('rejects a non date-only value', () => {
    const result = evaluateSchoolAgeEligibility('01/01/2022', census);
    expect(result.eligible).toBe(false);
    expect(parseDateOnly('01/01/2022')).toBeNull();
  });

  it('does not shift eligibility across timezones', () => {
    const lateEveningOffset = evaluateSchoolAgeEligibility(
      '2021-01-02',
      census,
    );
    expect(lateEveningOffset.eligible).toBe(true);
    expect(parseDateOnly('2021-01-02')?.getUTCHours()).toBe(0);
  });

  it('blocks submit gaps for an ineligible date of birth and missing nursery', () => {
    const gaps = getSchoolFormGaps(
      {
        child: {
          fullName: 'TEST CHILD',
          dateOfBirth: '2021-01-01',
          gender: 'Male',
          bloodGroup: 'O+',
          caste: 'ST',
          category: 'ST',
          community: 'Garo',
          nationality: 'Indian',
          lastSchool: 'ABC Nursery',
          attendedNursery: false,
        },
      },
      {
        censusDate: census,
        minAgeYears: 5,
        maxAgeYearsExclusive: 6,
        requireNursery: true,
      },
    );
    expect(gaps).toContain(SCHOOL_AGE_INELIGIBLE_MESSAGE);
    expect(gaps).toContain('Nursery attendance confirmation');
  });

  it('requires a dropdown category and community only when the policy says so', () => {
    const baseChild = {
      fullName: 'TEST CHILD',
      dateOfBirth: '2021-06-15',
      gender: 'Male',
      bloodGroup: 'O+',
      nationality: 'Indian',
      lastSchool: 'ABC Nursery',
      attendedNursery: true,
    };
    expect(
      getSchoolFormGaps({ child: { ...baseChild, category: 'GENERAL_UR' } }),
    ).not.toContain('Community / Tribe (if applicable)');
    expect(
      getSchoolFormGaps({ child: { ...baseChild, category: 'ST' } }),
    ).toContain('Community / Tribe (if applicable)');
    expect(
      getSchoolFormGaps({ child: { ...baseChild, caste: 'Garo' } }),
    ).toContain('Caste / Category');
  });

  it('requires a valid 6-digit PIN Code on permanent and present addresses', () => {
    const gapsMissing = getSchoolFormGaps({
      permanentAddress: {
        village: 'Sampalgre',
        po: 'Chandmari',
        district: 'West Garo Hills',
        state: 'Meghalaya',
      },
      presentAddress: {
        landmark: 'Sampalgre',
        po: 'Chandmari',
        district: 'West Garo Hills',
        state: 'Meghalaya',
      },
    });
    expect(gapsMissing).toContain('Permanent PIN Code');
    expect(gapsMissing).toContain('Present PIN Code');

    const gapsInvalid = getSchoolFormGaps({
      permanentAddress: {
        village: 'Sampalgre',
        po: 'Chandmari',
        district: 'West Garo Hills',
        state: 'Meghalaya',
        pinCode: '79400',
      },
      presentAddress: {
        landmark: 'Sampalgre',
        po: 'Chandmari',
        district: 'West Garo Hills',
        state: 'Meghalaya',
        pinCode: 'abc123',
      },
    });
    expect(gapsInvalid).toContain('Permanent PIN Code');
    expect(gapsInvalid).toContain('Present PIN Code');

    const gapsOk = getSchoolFormGaps({
      permanentAddress: {
        village: 'Sampalgre',
        po: 'Chandmari',
        district: 'West Garo Hills',
        state: 'Meghalaya',
        pinCode: '794001',
      },
      presentAddress: {
        landmark: 'Sampalgre',
        po: 'Chandmari',
        district: 'West Garo Hills',
        state: 'Meghalaya',
        pinCode: '794001',
      },
    });
    expect(gapsOk).not.toContain('Permanent PIN Code');
    expect(gapsOk).not.toContain('Present PIN Code');
  });
});

describe('school online application capacity', () => {
  it('defaults the cap to 50', () => {
    expect(schoolMaxOnlineApplications(null)).toBe(50);
    expect(schoolMaxOnlineApplications({})).toBe(50);
  });

  it('closes new registration when the cap is reached', () => {
    const result = evaluateSchoolAdmissionWindow({
      cycleStatus: 'OPEN',
      settings: { maxOnlineApplications: 50 } as never,
      currentApplicationCount: 50,
    });
    expect(result.isOpen).toBe(false);
    expect(result.closedReason).toBe('capacity');
    expect(result.seatsRemaining).toBe(0);
    expect(result.maxOnlineApplications).toBe(50);
  });

  it('reopens when the admin raises the cap', () => {
    const result = evaluateSchoolAdmissionWindow({
      cycleStatus: 'OPEN',
      settings: { maxOnlineApplications: 100 } as never,
      currentApplicationCount: 50,
    });
    expect(result.isOpen).toBe(true);
    expect(result.seatsRemaining).toBe(50);
    expect(result.maxOnlineApplications).toBe(100);
  });
});
