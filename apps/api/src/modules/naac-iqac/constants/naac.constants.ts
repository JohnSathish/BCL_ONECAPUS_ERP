export const NAAC_CRITERIA = [
  { criterion: 1, title: 'Curricular Aspects' },
  { criterion: 2, title: 'Teaching-Learning and Evaluation' },
  { criterion: 3, title: 'Research, Innovations and Extension' },
  { criterion: 4, title: 'Infrastructure and Learning Resources' },
  { criterion: 5, title: 'Student Support and Progression' },
  { criterion: 6, title: 'Governance, Leadership and Management' },
  { criterion: 7, title: 'Institutional Values and Best Practices' },
] as const;

export const NAAC_AQAR_SECTIONS = [
  'profile',
  'criterion_1',
  'criterion_2',
  'criterion_3',
  'criterion_4',
  'criterion_5',
  'criterion_6',
  'criterion_7',
  'best_practices',
  'institutional_distinctiveness',
] as const;

export const NAAC_AQAR_STATUSES = [
  'DRAFT',
  'IN_REVIEW',
  'SUBMITTED',
  'LOCKED',
] as const;

export const NAAC_FACULTY_ACHIEVEMENT_TYPES = [
  'publication',
  'book',
  'patent',
  'award',
  'fdp',
  'conference',
  'project',
] as const;

export const NAAC_STUDENT_ACHIEVEMENT_TYPES = [
  'sports',
  'cultural',
  'academic',
  'competition',
  'placement',
  'higher_studies',
] as const;

export const NAAC_MOU_PARTNER_TYPES = [
  'industry',
  'university',
  'ngo',
  'research',
] as const;

export const NAAC_CALENDAR_EVENT_TYPES = [
  'AQAR_DUE',
  'IQAC_MEETING',
  'DEPT_SUBMISSION',
  'ACADEMIC_AUDIT',
  'FEEDBACK',
  'SSR_REVIEW',
] as const;

export const NAAC_SUBMISSION_TYPES = [
  'activities',
  'seminars',
  'research',
  'results',
  'best_practices',
  'evidence',
] as const;

export const NAAC_EVIDENCE_SOURCE_TYPES = [
  'naac_vault',
  'governance_document',
  'governance_event',
  'governance_notice',
  'governance_action_item',
  'staff_publication',
  'staff_award',
  'staff_document',
  'faculty_achievement',
  'student_achievement',
  'mou',
] as const;

export function paginate(page?: number, limit?: number) {
  const p = Math.max(1, page ?? 1);
  const l = Math.min(200, Math.max(1, limit ?? 25));
  return { page: p, limit: l, skip: (p - 1) * l, take: l };
}
