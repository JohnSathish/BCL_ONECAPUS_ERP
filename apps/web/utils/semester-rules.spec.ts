import {
  categorySlotKeys,
  minorRequired,
  formatSemesterSummary,
  buildAutoSlotKeysFromRule,
} from '@/utils/semester-rules';

describe('semester-rules utils', () => {
  it('builds numbered major and minor slots', () => {
    expect(categorySlotKeys({ MAJOR: 2, MINOR: 2, VTC: 1 })).toEqual([
      'MAJOR-1',
      'MAJOR-2',
      'MINOR-1',
      'MINOR-2',
      'VTC',
    ]);
  });

  it('detects when minor is not required', () => {
    expect(minorRequired({ categoryCounts: { MAJOR: 2, VTC: 1 } })).toBe(false);
    expect(minorRequired({ categoryCounts: { MAJOR: 1, MINOR: 1 } })).toBe(true);
  });

  it('formats semester summaries', () => {
    expect(
      formatSemesterSummary({
        categoryCounts: { MAJOR: 3, MINOR: 1, INTERNSHIP: 1 },
      }),
    ).toBe('3 Major + Minor + Internship');
  });

  it('includes INTERNSHIP in auto-assigned slots for semester 5 rules', () => {
    const keys = buildAutoSlotKeysFromRule({
      categoryCounts: { MAJOR: 3, MINOR: 1, INTERNSHIP: 1 },
    });
    expect(keys).toEqual(['MAJOR-1', 'MAJOR-2', 'MAJOR-3', 'MINOR', 'INTERNSHIP']);
  });
});
