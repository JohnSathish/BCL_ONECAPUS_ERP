import {
  isStudentChoiceCategory,
  mandatoryFlagForCategory,
  shouldAutoAssignCategory,
  unfilledElectiveSlots,
} from './registration-category-classification';

describe('registration-category-classification', () => {
  const ruleLines = [
    { categoryType: 'MAJOR', mandatoryFlag: true },
    { categoryType: 'MDC', mandatoryFlag: true },
    { categoryType: 'SEC', mandatoryFlag: false },
  ];
  const electives = ['MDC', 'AEC', 'SEC', 'VAC', 'VTC'];

  it('treats MDC as student choice when in elective list', () => {
    expect(
      isStudentChoiceCategory(
        'MDC',
        mandatoryFlagForCategory('MDC', ruleLines),
        electives,
      ),
    ).toBe(true);
  });

  it('auto-assigns MAJOR in COMPULSORY_ONLY mode', () => {
    expect(
      shouldAutoAssignCategory('MAJOR', true, electives, 'COMPULSORY_ONLY'),
    ).toBe(true);
  });

  it('auto-assigns INTERNSHIP and PROJECT in COMPULSORY_ONLY mode', () => {
    expect(
      shouldAutoAssignCategory(
        'INTERNSHIP',
        true,
        electives,
        'COMPULSORY_ONLY',
      ),
    ).toBe(true);
    expect(
      shouldAutoAssignCategory('PROJECT', true, electives, 'COMPULSORY_ONLY'),
    ).toBe(true);
    expect(
      shouldAutoAssignCategory('RESEARCH', true, electives, 'COMPULSORY_ONLY'),
    ).toBe(true);
  });

  it('skips MDC in COMPULSORY_ONLY mode', () => {
    expect(
      shouldAutoAssignCategory(
        'MDC',
        mandatoryFlagForCategory('MDC', ruleLines),
        electives,
        'COMPULSORY_ONLY',
      ),
    ).toBe(false);
  });

  it('assigns MDC in ALL_CATEGORIES mode', () => {
    expect(
      shouldAutoAssignCategory(
        'MDC',
        mandatoryFlagForCategory('MDC', ruleLines),
        electives,
        'ALL_CATEGORIES',
      ),
    ).toBe(true);
  });

  it('computes unfilled elective slots', () => {
    const slots = unfilledElectiveSlots(
      { MAJOR: 1, MDC: 1, SEC: 1 },
      ruleLines,
      electives,
      { MAJOR: 1 },
    );
    expect(slots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'MDC', remaining: 1 }),
        expect.objectContaining({ category: 'SEC', remaining: 1 }),
      ]),
    );
    expect(slots.find((s) => s.category === 'MAJOR')).toBeUndefined();
  });
});
