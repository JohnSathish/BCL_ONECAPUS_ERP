import {
  computeSemesterTotals,
  DEFAULT_DEGREE_MIN_CREDITS,
  DEFAULT_FYUGP_SEMESTER_RULES,
  DEFAULT_SEMESTER_CREDIT_TARGET,
  formatSemesterSummary,
  resolveSemesterRuleWithPathway,
  semesterRulesToLines,
  DEFAULT_SEMESTER_8_PATHWAY_VARIANTS,
} from './fyugp-templates';

describe('official NEHU FYUGP structure', () => {
  it('defines eight semesters with twenty credits each', () => {
    expect(DEFAULT_FYUGP_SEMESTER_RULES).toHaveLength(8);
    for (const rule of DEFAULT_FYUGP_SEMESTER_RULES) {
      const totals = computeSemesterTotals(rule);
      expect(totals.credits).toBe(DEFAULT_SEMESTER_CREDIT_TARGET);
    }
  });

  it('matches regulation category counts for semesters 4 to 7', () => {
    const sem4 = DEFAULT_FYUGP_SEMESTER_RULES.find(
      (rule) => rule.semesterSequence === 4,
    );
    const sem5 = DEFAULT_FYUGP_SEMESTER_RULES.find(
      (rule) => rule.semesterSequence === 5,
    );
    const sem6 = DEFAULT_FYUGP_SEMESTER_RULES.find(
      (rule) => rule.semesterSequence === 6,
    );
    const sem7 = DEFAULT_FYUGP_SEMESTER_RULES.find(
      (rule) => rule.semesterSequence === 7,
    );

    expect(sem4?.categoryCounts).toEqual({ MAJOR: 4, VTC: 1 });
    expect(sem5?.categoryCounts).toEqual({ MAJOR: 3, MINOR: 1, INTERNSHIP: 1 });
    expect(sem6?.categoryCounts).toEqual({ MAJOR: 4, VTC: 1 });
    expect(sem7?.categoryCounts).toEqual({ MAJOR: 3, MINOR: 2 });
  });

  it('semester 3 has no minor and uses VTC', () => {
    const sem3 = DEFAULT_FYUGP_SEMESTER_RULES.find(
      (rule) => rule.semesterSequence === 3,
    );
    expect(sem3?.categoryCounts.MINOR).toBeUndefined();
    expect(sem3?.categoryCounts.VTC).toBe(1);
  });

  it('uses two credits for semester 3 AEC', () => {
    const sem3 = DEFAULT_FYUGP_SEMESTER_RULES.find(
      (rule) => rule.semesterSequence === 3,
    );
    expect(sem3?.categoryMeta?.AEC?.creditRule).toBe(2);
  });

  it('sums to 160 degree credits across eight semesters', () => {
    const total = DEFAULT_FYUGP_SEMESTER_RULES.reduce(
      (sum, rule) => sum + computeSemesterTotals(rule).credits,
      0,
    );
    expect(total).toBe(DEFAULT_DEGREE_MIN_CREDITS);
  });

  it('exports template lines for internship and dissertation pathways', () => {
    const lines = semesterRulesToLines(DEFAULT_FYUGP_SEMESTER_RULES);
    expect(lines.some((line) => line.categoryType === 'INTERNSHIP')).toBe(true);
    expect(lines.every((line) => line.optionalFlag === false)).toBe(true);
  });

  it('formats semester summaries', () => {
    const sem5 = DEFAULT_FYUGP_SEMESTER_RULES.find(
      (rule) => rule.semesterSequence === 5,
    )!;
    expect(formatSemesterSummary(sem5)).toBe('3 Major + Minor + Internship');
  });

  it('resolves semester 8 research pathway variant', () => {
    const sem8 = DEFAULT_FYUGP_SEMESTER_RULES.find(
      (rule) => rule.semesterSequence === 8,
    )!;
    const resolved = resolveSemesterRuleWithPathway(
      sem8,
      DEFAULT_SEMESTER_8_PATHWAY_VARIANTS,
      'HONOURS_WITH_RESEARCH',
    );
    expect(resolved.categoryCounts).toEqual({ DISSERTATION: 1, MAJOR: 2 });
    expect(computeSemesterTotals(resolved).credits).toBe(20);
  });

  it('defines semester 8 project pathway variant', () => {
    expect(
      DEFAULT_SEMESTER_8_PATHWAY_VARIANTS.WITH_PROJECT?.categoryCounts,
    ).toEqual({
      PROJECT: 1,
      MAJOR: 2,
    });
  });
});
