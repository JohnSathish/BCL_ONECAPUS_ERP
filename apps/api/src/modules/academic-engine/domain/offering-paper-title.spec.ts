import {
  offeringPaperTitle,
  offeringTitleOverride,
} from './offering-paper-title';

describe('offering paper title', () => {
  it('keeps the course master title when the mapping name matches', () => {
    expect(
      offeringTitleOverride('Indian Economy', 'Indian Economy'),
    ).toBeNull();
    expect(
      offeringPaperTitle({ title: 'Indian Economy' }, { titleOverride: null }),
    ).toBe('Indian Economy');
  });

  it('uses the mapping name when the same code has a different paper name', () => {
    expect(
      offeringTitleOverride(
        'Introduction to Remote Sensing and GIS',
        'Geography and Environment',
      ),
    ).toBe('Geography and Environment');
    expect(
      offeringPaperTitle(
        { title: 'Education for Sustainable Development' },
        { titleOverride: 'Inclusive Education I' },
      ),
    ).toBe('Inclusive Education I');
  });
});
