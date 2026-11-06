import {
  DEPARTMENT_ROLL_PREFIXES,
  prefixForDepartment,
  prefixForStreamCode,
} from './department-roll-prefix';

describe('department roll prefixes', () => {
  it('maps each major department to the prefix already used on 2026 rolls', () => {
    expect(prefixForDepartment('Economics')).toBe('EC');
    expect(prefixForDepartment('Education')).toBe('ED');
    expect(prefixForDepartment('English')).toBe('EN');
    expect(prefixForDepartment('Garo')).toBe('GA');
    expect(prefixForDepartment('Geography')).toBe('GE');
    expect(prefixForDepartment('History')).toBe('HI');
    expect(prefixForDepartment('Philosophy')).toBe('PHI');
    expect(prefixForDepartment('Political Science')).toBe('PS');
    expect(prefixForDepartment('Sociology')).toBe('SO');
    expect(prefixForDepartment('Commerce')).toBe('COM');
    expect(prefixForDepartment('Botany')).toBe('BOT');
    expect(prefixForDepartment('Chemistry')).toBe('CHE');
    expect(prefixForDepartment('Mathematics')).toBe('MAT');
    expect(prefixForDepartment('Physics')).toBe('PHY');
    expect(prefixForDepartment('Zoology')).toBe('ZOO');
  });

  it('reads the same prefix from a stream code', () => {
    expect(prefixForStreamCode('POLITICAL_SCIENCE')).toBe('PS');
    expect(prefixForStreamCode('ECONOMICS')).toBe('EC');
  });

  it('covers every configured department once', () => {
    expect(
      new Set(DEPARTMENT_ROLL_PREFIXES.map((row) => row.prefix)).size,
    ).toBe(DEPARTMENT_ROLL_PREFIXES.length);
  });
});
