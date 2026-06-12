import type { NepCategory } from './nep-categories';
import type {
  CompletedStudyRecord,
  CourseEligibilityRules,
  StudentEligibilityContext,
} from './course-eligibility.types';

export type Class12Subject = { name: string; code?: string; marks?: number };

export type RegistrationSelection = {
  category: NepCategory;
  offeringId: string;
  offeringSectionId: string;
  eligibilityOverride?: boolean;
  eligibilityOverrideReason?: string | null;
};

export type StudentChoiceSnapshot = {
  choiceType: 'MAJOR' | 'MINOR';
  subjectSlug: string;
};

export type SectionMeta = {
  offeringId: string;
  programVersionId?: string | null;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  category: NepCategory;
  subjectSlug: string;
  semesterSequence: number | null;
  shiftId: string;
  shiftCode: string;
  sectionCode: string;
  capacity: number;
  waitlistCapacity: number;
  confirmedCount: number;
  waitlistCount: number;
  courseCredits: number;
  vtcTrackGroupCode?: string | null;
  vtcTrackStage?: number | null;
  prerequisiteOfferingIds: string[];
  /** Empty = open to all streams */
  allowedStreamIds: string[];
  allowedStreamLabels: string[];
  eligibilityRules?: CourseEligibilityRules | Record<string, unknown>;
};

export type RegistrationValidationContext = {
  tenantId: string;
  studentId: string;
  programVersionId: string;
  semesterSequence: number;
  semesterId: string;
  selections: RegistrationSelection[];
  class12Subjects: Class12Subject[];
  activeChoices: StudentChoiceSnapshot[];
  categoryCounts: Record<string, number>;
  continuityRules: Record<string, string>;
  categoryRequirements: Record<
    string,
    { count: number; creditRule?: number; mandatory: boolean }
  >;
  semesterCreditTarget: number;
  degreeMinCredits: number;
  languageEligibility?: Record<string, unknown> | null;
  preferredShiftId?: string | null;
  studentStreamId?: string | null;
  studentStreamLabel?: string | null;
  windowOpen: boolean;
  windowLocked: boolean;
  priorConfirmedByCategory: Partial<Record<NepCategory, string>>;
  majorMinorTrackLocked?: boolean;
  vtcTrackGroupCode?: string | null;
  offeringMeta: Map<string, SectionMeta>;
  sectionMeta: Map<string, SectionMeta>;
  creditPolicy: { minCredits: number; maxCredits: number };
  draftCreditsByCategory: Record<string, number>;
  totalDraftCredits: number;
  confirmedCreditsByCategory: Record<string, number>;
  vacPolicy: { mandatoryVacRequired?: boolean };
  shiftPolicy: { enforcePreferredShift?: boolean; blockCrossShift?: boolean };
  eligibilityRules: Record<string, unknown>;
  maxActiveSemesters?: number;
  studentElectiveCategories?: string[];
  registrationWorkflowMode?: 'ADMIN_ONLY' | 'STUDENT_SELF' | 'HYBRID';
  programId?: string | null;
  completedStudy?: CompletedStudyRecord[];
  studentEligibilityContext?: StudentEligibilityContext;
};

export type ValidationSeverity = 'error' | 'warning';

export type ValidationIssue = {
  ok: false;
  code: string;
  message: string;
  severity: ValidationSeverity;
};
export type ValidationOk = { ok: true };
export type ValidationResult = ValidationOk | ValidationIssue;

export function issue(
  code: string,
  message: string,
  severity: ValidationSeverity = 'error',
): ValidationIssue {
  return { ok: false, code, message, severity };
}

export function warning(code: string, message: string): ValidationIssue {
  return issue(code, message, 'warning');
}

export function ok(): ValidationOk {
  return { ok: true };
}
