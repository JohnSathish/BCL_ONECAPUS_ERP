export const ELIGIBILITY_STREAM_CODES = [
  'ARTS',
  'SCIENCE',
  'COMMERCE',
  'ALL',
] as const;

export type EligibilityStreamCode = (typeof ELIGIBILITY_STREAM_CODES)[number];

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

export type CompletedStudyRecord = {
  subjectSlug: string;
  category: string;
  semesterSequence: number;
  courseId?: string;
};

export type Class12SubjectRecord = {
  name: string;
  code?: string;
  marks?: number;
};

export type StudentEligibilityContext = {
  programId?: string | null;
  programVersionId?: string | null;
  streamCode?: string | null;
  majorSubjectSlug?: string | null;
  minorSubjectSlug?: string | null;
  class12Subjects: Class12SubjectRecord[];
  completedStudy: CompletedStudyRecord[];
};

export type CourseEligibilityResult = {
  eligible: boolean;
  reasons: string[];
  codes: string[];
};
