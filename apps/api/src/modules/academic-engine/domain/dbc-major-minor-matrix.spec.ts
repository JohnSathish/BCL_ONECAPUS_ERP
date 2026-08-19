import {
  DBC_MAJOR_MINOR_MATRIX,
  allowedMinorsForDbcMajor,
  canonicalDbcMajorName,
  isAllowedDbcMajorMinorPair,
} from './dbc-major-minor-matrix';

describe('DBC major-minor matrix', () => {
  it('matches the approved First Semester arts/science combination table', () => {
    expect([...DBC_MAJOR_MINOR_MATRIX.Education]).toEqual([
      'Garo',
      'History',
      'Philosophy',
    ]);
    expect([...DBC_MAJOR_MINOR_MATRIX.English]).toEqual([
      'Education',
      'Geography',
      'Philosophy',
      'Political Science',
    ]);
    expect([...DBC_MAJOR_MINOR_MATRIX.Garo]).toEqual([
      'Education',
      'Geography',
      'Philosophy',
      'Sociology',
    ]);
    expect([...DBC_MAJOR_MINOR_MATRIX.Geography]).toEqual([
      'Economics',
      'Garo',
    ]);
    expect([...DBC_MAJOR_MINOR_MATRIX.History]).toEqual([
      'Economics',
      'Philosophy',
      'Political Science',
      'Sociology',
    ]);
    expect([...DBC_MAJOR_MINOR_MATRIX.Philosophy]).toEqual([
      'Education',
      'Garo',
      'Geography',
    ]);
    expect([...DBC_MAJOR_MINOR_MATRIX['Political Science']]).toEqual([
      'Economics',
      'Education',
      'History',
      'Sociology',
    ]);
    expect([...DBC_MAJOR_MINOR_MATRIX.Sociology]).toEqual([
      'Economics',
      'Garo',
      'History',
      'Political Science',
    ]);
    expect([...DBC_MAJOR_MINOR_MATRIX.Botany]).toEqual([
      'Zoology',
      'Chemistry',
    ]);
    expect([...DBC_MAJOR_MINOR_MATRIX.Chemistry]).toEqual([
      'Mathematics',
      'Physics',
    ]);
    expect([...DBC_MAJOR_MINOR_MATRIX.Mathematics]).toEqual([
      'Physics',
      'Chemistry',
    ]);
    expect([...DBC_MAJOR_MINOR_MATRIX.Zoology]).toEqual([
      'Botany',
      'Chemistry',
    ]);
    expect([...DBC_MAJOR_MINOR_MATRIX.Physics]).toEqual([
      'Chemistry',
      'Mathematics',
    ]);
  });

  it('resolves POL. SCIENCE aliases and Education combinations', () => {
    expect(canonicalDbcMajorName('POL. SCIENCE')).toBe('Political Science');
    expect([...allowedMinorsForDbcMajor('Education')]).toEqual([
      'Garo',
      'History',
      'Philosophy',
    ]);
    expect(isAllowedDbcMajorMinorPair('Education', 'Garo')).toBe(true);
    expect(isAllowedDbcMajorMinorPair('Education', 'Economics')).toBe(false);
    expect(isAllowedDbcMajorMinorPair('POL. SCIENCE', 'History')).toBe(true);
  });

  it('resolves Commerce Accounting for Business aliases', () => {
    expect(canonicalDbcMajorName('ACC. FOR BUSINESS')).toBe('Commerce');
    expect(canonicalDbcMajorName('Accounting for Business')).toBe('Commerce');
    expect(isAllowedDbcMajorMinorPair('ACC. FOR BUSINESS', 'ECONOMICS')).toBe(
      true,
    );
    expect(isAllowedDbcMajorMinorPair('Commerce', 'Mathematics')).toBe(true);
  });

  it('resolves Science MATHS aliases and official pairs', () => {
    expect(canonicalDbcMajorName('MATHS')).toBe('Mathematics');
    expect(isAllowedDbcMajorMinorPair('CHEMISTRY', 'MATHS')).toBe(true);
    expect(isAllowedDbcMajorMinorPair('PHYSICS', 'MATHS')).toBe(true);
    expect(isAllowedDbcMajorMinorPair('BOTANY', 'ZOOLOGY')).toBe(true);
  });
});
