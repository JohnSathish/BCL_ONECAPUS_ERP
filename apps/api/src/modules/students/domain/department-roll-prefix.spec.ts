import {
  DEPARTMENT_ROLL_PREFIXES,
  nextFreeInBand,
  prefixForDepartment,
  prefixForStreamCode,
  suggestDepartmentShiftBands,
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

  it('keeps Day at 01–100 and Morning at 101 when both fit', () => {
    const bands = suggestDepartmentShiftBands(61, 127);
    expect(bands.day).toEqual({ start: 1, end: 100, next: 62 });
    expect(bands.morning).toEqual({ start: 101, end: 200, next: 128 });
    expect(bands.note).toBeNull();
  });

  it('moves Morning past Day when Day already passed 100', () => {
    const bands = suggestDepartmentShiftBands(114, 0);
    expect(bands.day).toEqual({ start: 1, end: 150, next: 115 });
    expect(bands.morning.start).toBe(151);
    expect(bands.morning.next).toBe(151);
    expect(bands.note).toContain('114');
  });

  it('skips numbers already used in the department', () => {
    expect(nextFreeInBand(101, 200, [101, 102, 114], 127)).toBe(128);
    expect(nextFreeInBand(1, 100, [1, 2, 3], 100)).toBeNull();
  });
});
