import {
  majorMinorCategory,
  registrationLineCategoryWhere,
} from './attendance-display.util';

describe('attendance roster category', () => {
  it('keeps major and minor as separate class lists', () => {
    expect(majorMinorCategory('major')).toBe('MAJOR');
    expect(majorMinorCategory('Minor')).toBe('MINOR');
    expect(majorMinorCategory('AEC')).toBeNull();
    expect(registrationLineCategoryWhere('MAJOR')).toEqual({
      category: { equals: 'MAJOR', mode: 'insensitive' },
    });
    expect(registrationLineCategoryWhere('VAC')).toEqual({});
  });
});
