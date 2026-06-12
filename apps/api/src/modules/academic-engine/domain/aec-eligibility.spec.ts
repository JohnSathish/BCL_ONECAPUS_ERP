import {
  DEFAULT_AEC_ALLOWED_SLUGS,
  isAecSlugAllowed,
  mergeLanguageEligibility,
  resolveAecSubjectSlug,
} from './aec-eligibility';

describe('aec-eligibility', () => {
  it('maps Alternative English to english slug', () => {
    expect(
      resolveAecSubjectSlug({
        title: 'Alternative English',
        code: 'AEC-120',
        subjectSlug: null,
      }),
    ).toBe('english');
  });

  it('maps MIL Garo to garo slug', () => {
    expect(
      resolveAecSubjectSlug({
        title: 'MIL- I Garo',
        code: 'AEC–123',
        subjectSlug: null,
      }),
    ).toBe('garo');
  });

  it('extends eligibility when admin selects a regional MIL', () => {
    const merged = mergeLanguageEligibility(
      { allowedSlugs: [...DEFAULT_AEC_ALLOWED_SLUGS] },
      ['garo'],
    );
    expect(isAecSlugAllowed('garo', merged)).toBe(true);
    expect(isAecSlugAllowed('english', merged)).toBe(true);
  });
});
