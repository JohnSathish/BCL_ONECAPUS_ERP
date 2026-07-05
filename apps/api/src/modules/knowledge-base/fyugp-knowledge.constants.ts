import {
  DEFAULT_FYUGP_SEMESTER_RULES,
  DEFAULT_SEMESTER_CREDIT_TARGET,
  type SemesterRulePayload,
} from '../academic-engine/domain/fyugp-templates';

const CATEGORY_LABELS: Record<string, string> = {
  MAJOR: 'Major/Core',
  MINOR: 'Minor/Core',
  MDC: 'MDC',
  AEC: 'AEC',
  SEC: 'SEC',
  VAC: 'VAC',
  VTC: 'VTC',
  INTERNSHIP: 'Internship',
  PROJECT: 'Project',
  RESEARCH: 'Research',
  DISSERTATION: 'Dissertation',
};

/** Detailed Sem I–II code patterns from NEHU framework PDF. */
const DETAILED_SEM_LINES: Record<
  number,
  Array<{
    category: string;
    courseCodePattern: string;
    credits: number;
    papers: number;
  }>
> = {
  1: [
    {
      category: 'Major/Core',
      courseCodePattern: 'SUB-100',
      credits: 4,
      papers: 1,
    },
    {
      category: 'Minor/Core',
      courseCodePattern: 'SUB-101',
      credits: 4,
      papers: 1,
    },
    {
      category: 'MDC',
      courseCodePattern: 'MDC-110/111/…/119',
      credits: 3,
      papers: 1,
    },
    {
      category: 'AEC',
      courseCodePattern: 'AEC-120/121/…/129',
      credits: 3,
      papers: 1,
    },
    {
      category: 'SEC',
      courseCodePattern: 'SEC-130/131/…/139',
      credits: 3,
      papers: 1,
    },
    { category: 'VAC', courseCodePattern: 'VAC-140', credits: 3, papers: 1 },
  ],
  2: [
    {
      category: 'Major/Core',
      courseCodePattern: 'SUB-150',
      credits: 4,
      papers: 1,
    },
    {
      category: 'Minor/Core',
      courseCodePattern: 'SUB-151',
      credits: 4,
      papers: 1,
    },
    {
      category: 'MDC',
      courseCodePattern: 'MDC-160/161/…/169',
      credits: 3,
      papers: 1,
    },
    {
      category: 'AEC',
      courseCodePattern: 'AEC-170/171/…/179',
      credits: 3,
      papers: 1,
    },
    {
      category: 'SEC',
      courseCodePattern: 'SEC-180/181/…/189',
      credits: 3,
      papers: 1,
    },
    { category: 'VAC', courseCodePattern: 'VAC-190/…', credits: 3, papers: 1 },
  ],
};

export function semesterPlanLines(rule: SemesterRulePayload) {
  if (DETAILED_SEM_LINES[rule.semesterSequence]) {
    return DETAILED_SEM_LINES[rule.semesterSequence];
  }
  return Object.entries(rule.categoryCounts ?? {})
    .filter(([, count]) => count > 0)
    .map(([cat, count]) => {
      const credits = rule.categoryMeta?.[cat]?.creditRule ?? 0;
      const label = CATEGORY_LABELS[cat] ?? cat;
      return {
        category: count > 1 ? `${label} (${count} papers)` : label,
        courseCodePattern: cat,
        credits,
        papers: count,
      };
    });
}

export function allFyugpSemesterPlans() {
  return DEFAULT_FYUGP_SEMESTER_RULES.map((rule) => ({
    semester: rule.semesterSequence,
    totalCredits: rule.semesterCreditTarget ?? DEFAULT_SEMESTER_CREDIT_TARGET,
    lines: semesterPlanLines(rule),
  }));
}

export const NEHU_DEFINITIONS: Array<{ term: string; definition: string }> = [
  {
    term: 'FYUP',
    definition:
      'Four-Year Undergraduate Programme under NEP 2020, requiring 160 credits across eight semesters.',
  },
  {
    term: 'MDC',
    definition:
      'Multidisciplinary Course — a course outside the major/minor that broadens learning across disciplines.',
  },
  {
    term: 'AEC',
    definition:
      'Ability Enhancement Course — language and communication skills courses (e.g. MIL, Alternative English).',
  },
  {
    term: 'SEC',
    definition:
      'Skill Enhancement Course — practical skill-oriented courses such as Public Speaking, Motivation, or Team Building.',
  },
  {
    term: 'VAC',
    definition:
      'Value Added Course — courses that build values and awareness (e.g. Environmental Science).',
  },
  {
    term: 'VTC',
    definition:
      'Vocational Training Course — skill/vocational track papers offered in later semesters of the FYUGP structure.',
  },
  {
    term: 'MAJOR',
    definition:
      'Major/Core — primary discipline papers that form the core of the undergraduate programme.',
  },
  {
    term: 'MINOR',
    definition:
      'Minor/Core — secondary discipline papers taken alongside the Major.',
  },
  {
    term: 'NEP',
    definition:
      'National Education Policy 2020 — the policy framework under which NEHU FYUGP curriculum is designed.',
  },
  {
    term: 'UG',
    definition:
      'Undergraduate programme. A 3-year exit requires 120 credits; the full FYUP requires 160 credits.',
  },
];

export const NEHU_FACTS: Array<{ key: string; label: string; value: string }> =
  [
    { key: 'FYUP_TOTAL_CREDITS', label: 'FYUP total credits', value: '160' },
    {
      key: 'UG3_TOTAL_CREDITS',
      label: '3-year UG total credits',
      value: '120',
    },
    {
      key: 'SEMESTER_CREDIT_TARGET',
      label: 'Credits per semester',
      value: '20',
    },
    { key: 'FYUP_TOTAL_SEMESTERS', label: 'FYUP total semesters', value: '8' },
    {
      key: 'MAJOR_CREDITS_4Y',
      label: 'Major credits in 4-year FYUP',
      value: '80',
    },
    {
      key: 'MINOR_CREDITS_4Y',
      label: 'Minor credits in 4-year FYUP',
      value: '20',
    },
  ];

export const SEM1_CATALOGUE = [
  ['MDC-110', 'Introductory Life Sciences', 'MDC', 3, 1],
  ['MDC-111', 'Mathematics in Daily Life', 'MDC', 3, 1],
  ['MDC-112', 'Culture and Society', 'MDC', 3, 1],
  ['MDC-113', 'Foundations of Library & Information Science', 'MDC', 3, 1],
  ['MDC-114', 'NSS and Youth', 'MDC', 3, 1],
  ['MDC-115', 'Introduction to Social Work Practice', 'MDC', 3, 1],
  ['AEC-120', 'MIL', 'AEC', 3, 1],
  ['AEC-121', 'Alternative English', 'AEC', 3, 1],
  ['SEC-130', 'Public Speaking', 'SEC', 3, 1],
  ['SEC-131', 'Motivation', 'SEC', 3, 1],
  ['SEC-132', 'Team Building', 'SEC', 3, 1],
  ['VAC-140', 'Environmental Science', 'VAC', 3, 1],
  ['SUB-100', 'Major / Core (subject paper)', 'MAJOR', 4, 1],
  ['SUB-101', 'Minor / Core (subject paper)', 'MINOR', 4, 1],
] as const;
