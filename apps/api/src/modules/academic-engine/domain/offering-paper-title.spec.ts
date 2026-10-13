import {
  offeringPaperTitle,
  offeringTitleOverride,
  registeredSubjectPrint,
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

  it('prints the registration mapping, not a catalog substitute', () => {
    const course = {
      code: 'EDN-302',
      title: 'Education for Sustainable Development',
    };
    expect(registeredSubjectPrint(course, { titleOverride: null })).toEqual({
      code: 'EDN-302',
      title: 'Education for Sustainable Development',
    });
    expect(
      registeredSubjectPrint(course, {
        titleOverride: 'Inclusive Education I',
      }),
    ).toEqual({
      code: 'EDN-302',
      title: 'Inclusive Education I',
    });
    expect(
      registrationPaperTitle(course, { titleOverride: null }, 'MINOR'),
    ).toBe(offeringPaperTitle(course, { titleOverride: null }));
  });

  it('keeps a renamed course title instead of the old catalog name', () => {
    expect(
      registeredSubjectPrint(
        {
          code: 'GAR-300',
          title: 'Literary Theory and Criticism – II',
        },
        { titleOverride: null },
      ),
    ).toEqual({
      code: 'GAR-300',
      title: 'Literary Theory and Criticism – II',
    });
    expect(
      registeredSubjectPrint(
        { code: 'GAR-302', title: 'Garo Fiction – I' },
        null,
      ),
    ).toEqual({ code: 'GAR-302', title: 'Garo Fiction – I' });
  });
});
