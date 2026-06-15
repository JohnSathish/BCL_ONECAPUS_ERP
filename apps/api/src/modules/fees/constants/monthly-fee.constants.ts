export const MONTHLY_DEMAND_TYPE = 'MONTHLY_TUITION';
export const ADMISSION_DEMAND_TYPE = 'ADMISSION_SESSION';

export const DON_BOSCO_MONTHLY_PLANS = [
  {
    code: 'ARTS_MORNING',
    name: 'FYUP Arts — Morning/Evening',
    majorSlug: 'arts',
    shiftCodes: ['MORNING', 'EVENING'],
    lines: [
      { code: 'TUITION', name: 'Tuition Fee', amount: 100 },
      { code: 'COLLEGE_FEE', name: 'College Fee', amount: 600 },
    ],
  },
  {
    code: 'ARTS_DAY',
    name: 'FYUP Arts — Day',
    majorSlug: 'arts',
    shiftCodes: ['DAY'],
    lines: [
      { code: 'TUITION', name: 'Tuition Fee', amount: 100 },
      { code: 'COLLEGE_FEE', name: 'College Fee', amount: 850 },
    ],
  },
  {
    code: 'ARTS_GEO_PRACTICAL',
    name: 'Arts with Geography Practical',
    majorSlug: 'geography',
    shiftCodes: ['*'],
    lines: [
      { code: 'TUITION', name: 'Tuition Fee', amount: 100 },
      { code: 'COLLEGE_FEE', name: 'College Fee', amount: 800 },
      { code: 'LAB_FEE', name: 'Lab Fee', amount: 200 },
    ],
  },
  {
    code: 'COMMERCE',
    name: 'Commerce Major',
    majorSlug: 'commerce',
    shiftCodes: ['*'],
    lines: [
      { code: 'TUITION', name: 'Tuition Fee', amount: 100 },
      { code: 'COLLEGE_FEE', name: 'College Fee', amount: 900 },
    ],
  },
  {
    code: 'SCIENCE',
    name: 'Science Major',
    majorSlug: 'science',
    shiftCodes: ['*'],
    lines: [
      { code: 'TUITION', name: 'Tuition Fee', amount: 100 },
      { code: 'COLLEGE_FEE', name: 'College Fee', amount: 900 },
      { code: 'LAB_FEE', name: 'Lab Fee', amount: 450 },
      { code: 'LAB_EXPENDABLES', name: 'Lab Expendables', amount: 350 },
    ],
  },
] as const;

export const VTC_MONTHLY_MODIFIER = {
  code: 'VTC',
  name: 'VTC Subject',
  ruleType: 'VTC',
  amount: 100,
};
