/**
 * NEHU FYUGP Geography — official syllabus reference (2024).
 * Course codes use standard DEPT-### form (GEO-100, not GEO:100).
 *
 * Practical papers (hasPractical) drive lab scheduling and BA-GEO fee plan
 * (ARTS_GEO_PRACTICAL + LAB_FEE).
 */

import { formatNehuCourseCode } from './course-code.util';

export const GEOGRAPHY_NEHU_META = {
  departmentCode: 'GEO',
  programCode: 'BA-GEO',
  subjectSlug: 'geography',
  programmeName: 'FYUP in Geography',
} as const;

/** Geography major allowed minors (Morning + Day arts matrix). */
export const GEOGRAPHY_MAJOR_ALLOWED_MINORS = ['Economics', 'Garo'] as const;

export type GeographyDeliveryKind = 'THEORY' | 'PRACTICAL' | 'INTERNSHIP';

export type GeographyNehuPaper = {
  code: string;
  title: string;
  semester: number;
  category: 'MAJOR' | 'MINOR' | 'INTERNSHIP';
  deliveryKind: GeographyDeliveryKind;
  credits: number;
  theoryCredits: number;
  practicalCredits: number;
  contactHours: number;
  notes?: string;
};

export const GEOGRAPHY_NEHU_PAPERS: GeographyNehuPaper[] = [
  {
    code: formatNehuCourseCode('GEO', 100),
    title: 'Introduction to Human Geography',
    semester: 1,
    category: 'MAJOR',
    deliveryKind: 'THEORY',
    credits: 4,
    theoryCredits: 4,
    practicalCredits: 0,
    contactHours: 60,
    notes: 'Also offered as MINOR (same code).',
  },
  {
    code: formatNehuCourseCode('GEO', 150),
    title: 'Introduction to Physical Geography',
    semester: 2,
    category: 'MAJOR',
    deliveryKind: 'THEORY',
    credits: 4,
    theoryCredits: 4,
    practicalCredits: 0,
    contactHours: 60,
    notes: 'Also offered as MINOR via GEO-151 cross-programme slot.',
  },
  {
    code: formatNehuCourseCode('GEO', 200),
    title: 'Regional Geography of India',
    semester: 3,
    category: 'MAJOR',
    deliveryKind: 'THEORY',
    credits: 4,
    theoryCredits: 4,
    practicalCredits: 0,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('GEO', 201),
    title: 'Historical Development of Geography',
    semester: 3,
    category: 'MAJOR',
    deliveryKind: 'THEORY',
    credits: 4,
    theoryCredits: 4,
    practicalCredits: 0,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('GEO', 250),
    title: 'Settlement Geography',
    semester: 4,
    category: 'MAJOR',
    deliveryKind: 'THEORY',
    credits: 4,
    theoryCredits: 4,
    practicalCredits: 0,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('GEO', 251),
    title: 'Fundamentals of Economic Geography',
    semester: 4,
    category: 'MAJOR',
    deliveryKind: 'THEORY',
    credits: 4,
    theoryCredits: 4,
    practicalCredits: 0,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('GEO', 252),
    title: 'Statistical Techniques in Geography',
    semester: 4,
    category: 'MAJOR',
    deliveryKind: 'PRACTICAL',
    credits: 4,
    theoryCredits: 0,
    practicalCredits: 4,
    contactHours: 120,
  },
  {
    code: formatNehuCourseCode('GEO', 253),
    title: 'Thematic Cartography and Survey Techniques I',
    semester: 4,
    category: 'MAJOR',
    deliveryKind: 'PRACTICAL',
    credits: 4,
    theoryCredits: 0,
    practicalCredits: 4,
    contactHours: 120,
  },
  {
    code: formatNehuCourseCode('GEO', 300),
    title: 'Thematic Cartography and Survey Techniques II',
    semester: 5,
    category: 'MAJOR',
    deliveryKind: 'PRACTICAL',
    credits: 4,
    theoryCredits: 0,
    practicalCredits: 4,
    contactHours: 120,
  },
  {
    code: formatNehuCourseCode('GEO', 301),
    title: 'Population Geography',
    semester: 5,
    category: 'MAJOR',
    deliveryKind: 'THEORY',
    credits: 4,
    theoryCredits: 4,
    practicalCredits: 0,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('GEO', 302),
    title: 'Introduction to Remote Sensing and GIS',
    semester: 5,
    category: 'MAJOR',
    deliveryKind: 'PRACTICAL',
    credits: 4,
    theoryCredits: 0,
    practicalCredits: 4,
    contactHours: 120,
    notes:
      'GEO-302 also serves as MINOR (Geography and Environment — theory) for other majors.',
  },
  {
    code: formatNehuCourseCode('GEO', 303),
    title:
      'Internship / Apprenticeship / Community Engagement and Service / Field Based Learning or Minor Project',
    semester: 5,
    category: 'INTERNSHIP',
    deliveryKind: 'INTERNSHIP',
    credits: 4,
    theoryCredits: 0,
    practicalCredits: 0,
    contactHours: 120,
  },
  {
    code: formatNehuCourseCode('GEO', 350),
    title: 'Geography of Resources',
    semester: 6,
    category: 'MAJOR',
    deliveryKind: 'THEORY',
    credits: 4,
    theoryCredits: 4,
    practicalCredits: 0,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('GEO', 351),
    title: 'Regional Geography of South East Asia',
    semester: 6,
    category: 'MAJOR',
    deliveryKind: 'THEORY',
    credits: 4,
    theoryCredits: 4,
    practicalCredits: 0,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('GEO', 352),
    title: 'Methods of Data Collection and Field Techniques',
    semester: 6,
    category: 'MAJOR',
    deliveryKind: 'THEORY',
    credits: 4,
    theoryCredits: 4,
    practicalCredits: 0,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('GEO', 353),
    title: 'Field Study and Project Report',
    semester: 6,
    category: 'MAJOR',
    deliveryKind: 'PRACTICAL',
    credits: 4,
    theoryCredits: 0,
    practicalCredits: 4,
    contactHours: 120,
  },
];

/** Sem 5 minor title for GEO-302 when offered on other BA programmes. */
export const GEOGRAPHY_SEM5_MINOR_TITLE = 'Geography and Environment';
