export type LibraryHealthComponent = {
  key: 'coverage' | 'circulation' | 'digital' | 'overdueControl' | 'engagement';
  label: string;
  score: number | null;
  detail: string;
  formula: string;
  weight: number;
};

export type LibraryHealthInput = {
  eligibleCopies: number;
  completeCopies: number;
  periodEvents: number;
  periodLabel: string;
  publishedDigitalAssets: number;
  digitalViews: number;
  activeLoans: number;
  overdueLoans: number;
  weekEvents: number;
};

const WEIGHTS = {
  coverage: 0.25,
  circulation: 0.25,
  digital: 0.15,
  overdueControl: 0.2,
  engagement: 0.15,
} as const;

/**
 * Circulation and weekly scores treat a stated share of the physical
 * collection as a full score. They are ratios, not targets stored in settings.
 * 2% of copies circulating in the selected period scores 100.
 * Weekly events equal to 5% of copies score 100.
 */
const CIRCULATION_FULL_SHARE = 0.02;
const WEEKLY_FULL_SHARE = 0.05;

function cap(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function libraryHealth(input: LibraryHealthInput) {
  const coverage =
    input.eligibleCopies > 0
      ? cap((input.completeCopies / input.eligibleCopies) * 100)
      : null;
  const circulation =
    input.eligibleCopies > 0
      ? cap(
          (input.periodEvents / input.eligibleCopies / CIRCULATION_FULL_SHARE) *
            100,
        )
      : null;
  const digital =
    input.publishedDigitalAssets > 0
      ? cap((input.digitalViews / input.publishedDigitalAssets) * 100)
      : null;
  const overdueControl =
    input.activeLoans > 0
      ? cap((1 - input.overdueLoans / input.activeLoans) * 100)
      : null;
  const engagement =
    input.eligibleCopies > 0
      ? cap((input.weekEvents / input.eligibleCopies / WEEKLY_FULL_SHARE) * 100)
      : null;

  const components: LibraryHealthComponent[] = [
    {
      key: 'coverage',
      label: 'Collection Coverage',
      score: coverage,
      weight: WEIGHTS.coverage,
      detail:
        coverage === null
          ? 'No physical copies are registered.'
          : `${input.completeCopies.toLocaleString('en-IN')} of ${input.eligibleCopies.toLocaleString('en-IN')} copies have an accession number, title, classification, and department.`,
      formula:
        'Copies with an accession number, title, call number or classification, and a department, divided by physical copies.',
    },
    {
      key: 'circulation',
      label: 'Circulation Activity',
      score: circulation,
      weight: WEIGHTS.circulation,
      detail:
        circulation === null
          ? 'No physical copies are registered.'
          : `${input.periodEvents.toLocaleString('en-IN')} issue, return, and renewal events ${input.periodLabel}.`,
      formula:
        'Issue, return, and renewal events in the selected period. Circulating 2% of physical copies scores 100.',
    },
    {
      key: 'digital',
      label: 'Digital Engagement',
      score: digital,
      weight: WEIGHTS.digital,
      detail:
        digital === null
          ? 'No published digital resources, so views cannot be compared with a collection.'
          : `${input.digitalViews.toLocaleString('en-IN')} views of ${input.publishedDigitalAssets.toLocaleString('en-IN')} published resources in the selected period.`,
      formula:
        'Digital access-log views in the selected period, divided by published digital resources.',
    },
    {
      key: 'overdueControl',
      label: 'Overdue Control',
      score: overdueControl,
      weight: WEIGHTS.overdueControl,
      detail:
        overdueControl === null
          ? 'No books are currently on loan.'
          : `${input.overdueLoans.toLocaleString('en-IN')} of ${input.activeLoans.toLocaleString('en-IN')} active loans are past the due date.`,
      formula:
        '100 minus the percentage of active loans that are overdue. A higher overdue rate lowers the score.',
    },
    {
      key: 'engagement',
      label: 'Weekly Engagement',
      score: engagement,
      weight: WEIGHTS.engagement,
      detail:
        engagement === null
          ? 'No physical copies are registered.'
          : `${input.weekEvents.toLocaleString('en-IN')} issues, returns, renewals, visits, and digital views in the last 7 days.`,
      formula:
        'Issues, returns, renewals, library visits, and digital views in the last 7 days. Events equal to 5% of physical copies score 100.',
    },
  ];

  const available = components.filter((item) => item.score !== null);
  const weight = available.reduce((sum, item) => sum + item.weight, 0);
  const overall =
    weight > 0
      ? Math.round(
          available.reduce(
            (sum, item) => sum + (item.score ?? 0) * item.weight,
            0,
          ) / weight,
        )
      : null;

  return {
    overall,
    components,
    weights: WEIGHTS,
    periodLabel: input.periodLabel,
  };
}
