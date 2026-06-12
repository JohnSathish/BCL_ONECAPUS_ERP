export type EligibilityStreamCode = 'ARTS' | 'SCIENCE' | 'COMMERCE' | 'ALL';

export type Class12SubjectExclusion = {
  subjectSlug: string;
  label?: string;
};

export type PriorStudyExclusion = {
  subjectSlug: string;
  semesterSequence?: number;
  category?: string;
  label?: string;
};

export type CourseEligibilityRules = {
  allowedStreams?: EligibilityStreamCode[];
  excludedStreams?: EligibilityStreamCode[];
  allowedProgramIds?: string[];
  excludedProgramIds?: string[];
  allowedProgramVersionIds?: string[];
  excludedProgramVersionIds?: string[];
  allowedMajorSubjectSlugs?: string[];
  excludedMajorSubjectSlugs?: string[];
  class12SubjectExclusions?: Class12SubjectExclusion[];
  priorStudyExclusions?: PriorStudyExclusion[];
};

export type CourseEligibilityPreviewResult = {
  eligible: boolean;
  reasons: string[];
  codes: string[];
  rules: CourseEligibilityRules;
};

export type CourseEligibilityStats = {
  eligible: number;
  blocked: number;
  total: number;
};

export type AcademicSubjectOption = {
  id: string;
  slug: string;
  name: string;
  programmeGroup?: string | null;
  departmentId?: string | null;
};

export const ELIGIBILITY_STREAM_OPTIONS: { code: EligibilityStreamCode; label: string }[] = [
  { code: 'ARTS', label: 'Arts' },
  { code: 'SCIENCE', label: 'Science' },
  { code: 'COMMERCE', label: 'Commerce' },
  { code: 'ALL', label: 'All streams' },
];

export const EMPTY_ELIGIBILITY_RULES: CourseEligibilityRules = {};
