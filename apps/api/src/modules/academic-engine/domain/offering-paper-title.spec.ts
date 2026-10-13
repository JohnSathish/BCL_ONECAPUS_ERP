import {
  offeringPaperTitle,
  offeringTitleOverride,
  registrationPaperTitle,
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

  it('prints Inclusive Education I for a minor registration on EDN-302', () => {
    const course = {
      code: 'EDN-302',
      title: 'Education for Sustainable Development',
    };
    expect(registrationPaperTitle(course, null, 'MINOR')).toBe(
      'Inclusive Education I',
    );
    expect(registrationPaperTitle(course, null, 'MAJOR')).toBe(
      'Education for Sustainable Development',
    );
  });

  it('keeps a renamed course title instead of the old catalog name', () => {
    expect(
      registrationPaperTitle(
        {
          code: 'GAR-300',
          title: 'Literary Theory and Criticism – II',
        },
        { titleOverride: null, category: 'MAJOR' },
        'MAJOR',
      ),
    ).toBe('Literary Theory and Criticism – II');
    expect(
      registrationPaperTitle(
        { code: 'GAR-302', title: 'Garo Fiction – I' },
        null,
        'MINOR',
      ),
    ).toBe('Garo Fiction – I');
  });
});
