import {
  formatNehuCourseCode,
  isValidNehuCourseCode,
  normalizeNehuCourseCode,
} from './course-code.util';

describe('course-code.util', () => {
  it('normalizes colon and space variants to DEPT-###', () => {
    expect(normalizeNehuCourseCode('EDN:100')).toBe('EDN-100');
    expect(normalizeNehuCourseCode('EDN : 100')).toBe('EDN-100');
    expect(normalizeNehuCourseCode('EDN100')).toBe('EDN-100');
    expect(normalizeNehuCourseCode('eco-100')).toBe('ECO-100');
  });

  it('preserves valid hyphenated pool codes', () => {
    expect(normalizeNehuCourseCode('MDC-117')).toBe('MDC-117');
    expect(normalizeNehuCourseCode('VTC-243.2')).toBe('VTC-243.2');
    expect(isValidNehuCourseCode('EDN-303')).toBe(true);
  });

  it('formats department and paper number', () => {
    expect(formatNehuCourseCode('EDN', 150)).toBe('EDN-150');
  });
});
