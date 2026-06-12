import {
  expectedVtcStageForSemester,
  resolveVtcTrackFields,
} from '../../../../common/services/vtc-track-metadata';
import type {
  RegistrationSelection,
  RegistrationValidationContext,
  SectionMeta,
  ValidationResult,
} from '../registration-context';
import { issue, ok, warning } from '../registration-context';
import { isNepCategory, slugifySubject } from '../nep-categories';
import { ALWAYS_AUTO_ASSIGNED } from '../registration-category-classification';
import { requiredMajorPaperCount } from '../major-paper-assignment';
import {
  isStudentEligibleForSection,
  formatStreamIneligibleMessage,
} from '../../../../common/utils/stream-eligibility';
import {
  evaluateCourseEligibility,
  isRulesEmpty,
  normalizeCourseEligibilityRules,
} from '../course-eligibility.engine';

export type Validator = (
  ctx: RegistrationValidationContext,
) => ValidationResult;

function sectionMeta(ctx: RegistrationValidationContext, sectionId: string) {
  return ctx.sectionMeta.get(sectionId) ?? ctx.offeringMeta.get(sectionId);
}

/** FYUGP Sem 1/3: minor may use another programme's MAJOR (-100) offering. */
function allowsFyugpCrossMajorMinor(
  ctx: RegistrationValidationContext,
  sel: RegistrationSelection,
  meta: SectionMeta,
): boolean {
  if (sel.category !== 'MINOR' || meta.category !== 'MAJOR') return false;
  if (ctx.semesterSequence !== 1 && ctx.semesterSequence !== 3) return false;
  const offeringProgramVersionId = meta.programVersionId ?? null;
  return Boolean(
    offeringProgramVersionId &&
    offeringProgramVersionId !== ctx.programVersionId,
  );
}

export const registrationWindowValidator: Validator = (ctx) => {
  if (ctx.windowLocked)
    return issue('WINDOW_LOCKED', 'Registration window is locked');
  if (!ctx.windowOpen)
    return issue('WINDOW_CLOSED', 'Registration window is not open');
  return ok();
};

export const semesterStructureValidator: Validator = (ctx) => {
  const max = ctx.maxActiveSemesters ?? 8;
  if (ctx.semesterSequence > max) {
    return issue(
      'SEMESTER_NOT_SUPPORTED',
      `Semester ${ctx.semesterSequence} exceeds institution maximum (${max})`,
    );
  }
  const required = ctx.categoryCounts;
  const selected: Record<string, number> = {};
  for (const s of ctx.selections) {
    selected[s.category] = (selected[s.category] ?? 0) + 1;
  }
  for (const [cat, count] of Object.entries(required)) {
    if ((selected[cat] ?? 0) !== count) {
      return issue(
        'CATEGORY_COUNT_MISMATCH',
        `Expected ${count} ${cat} selection(s), got ${selected[cat] ?? 0}`,
      );
    }
  }
  for (const cat of Object.keys(selected)) {
    if (!required[cat]) {
      return issue(
        'EXTRA_CATEGORY',
        `Unexpected selection for category ${cat}`,
      );
    }
  }
  return ok();
};

export const continuityValidator: Validator = (ctx) => {
  if (ctx.semesterSequence < 2) return ok();
  const rules = ctx.continuityRules;
  for (const sel of ctx.selections) {
    if (rules[sel.category] !== 'LOCK') continue;
    const prior = ctx.priorConfirmedByCategory[sel.category];
    if (prior && prior !== sel.offeringId) {
      return issue(
        'CONTINUITY_VIOLATION',
        `${sel.category} must remain the same as the previous locked semester`,
      );
    }
  }
  return ok();
};

export const majorMinorTrackValidator: Validator = (ctx) => {
  if (!ctx.majorMinorTrackLocked) return ok();
  if (ctx.semesterSequence <= 1) return ok();
  return ok();
};

export const vtcTrackValidator: Validator = (ctx) => {
  const vtcSelections = ctx.selections.filter((s) => s.category === 'VTC');
  if (vtcSelections.length === 0) return ok();

  const expectedStage = expectedVtcStageForSemester(ctx.semesterSequence);
  for (const sel of vtcSelections) {
    const meta = sectionMeta(ctx, sel.offeringSectionId);
    if (!meta) {
      return issue('OFFERING_NOT_FOUND', 'VTC section not found');
    }
    const trackMeta = resolveVtcTrackFields({
      code: meta.courseCode,
      title: meta.courseTitle,
      vtcTrackGroupCode: meta.vtcTrackGroupCode,
      vtcTrackStage: meta.vtcTrackStage,
    });
    if (!trackMeta.vtcTrackGroupCode) {
      return issue(
        'VTC_TRACK_METADATA_MISSING',
        `Course ${meta.courseCode} is missing VTC track metadata`,
      );
    }
    if (expectedStage != null && trackMeta.vtcTrackStage !== expectedStage) {
      return issue(
        'VTC_STAGE_MISMATCH',
        `VTC course ${meta.courseCode} is stage ${trackMeta.vtcTrackStage ?? '?'}; semester ${ctx.semesterSequence} requires stage ${expectedStage}`,
      );
    }
    if (
      ctx.semesterSequence > 3 &&
      ctx.vtcTrackGroupCode &&
      trackMeta.vtcTrackGroupCode !== ctx.vtcTrackGroupCode
    ) {
      return issue(
        'VTC_TRACK_VIOLATION',
        `VTC must continue track "${ctx.vtcTrackGroupCode}", not "${trackMeta.vtcTrackGroupCode}"`,
      );
    }
  }
  return ok();
};

export const mdcConflictValidator: Validator = (ctx) => {
  const mdcSelections = ctx.selections.filter((s) => s.category === 'MDC');
  if (mdcSelections.length === 0) return ok();

  const blocked = new Set<string>();
  for (const c of ctx.activeChoices) blocked.add(c.subjectSlug);
  for (const s of ctx.class12Subjects) blocked.add(slugifySubject(s.name));

  for (const sel of mdcSelections) {
    const meta = sectionMeta(ctx, sel.offeringSectionId);
    if (!meta) return issue('OFFERING_NOT_FOUND', 'MDC section not found');
    if (blocked.has(meta.subjectSlug)) {
      return issue(
        'MDC_CONFLICT',
        `MDC cannot match major, minor, or Class 12 subject (${meta.subjectSlug})`,
      );
    }
  }
  return ok();
};

export const aecEligibilityValidator: Validator = (ctx) => {
  const aecSelections = ctx.selections.filter((s) => s.category === 'AEC');
  if (aecSelections.length === 0) return ok();
  const eligibility = ctx.languageEligibility as
    | { allowedSlugs?: string[] }
    | null
    | undefined;
  if (!eligibility?.allowedSlugs?.length) return ok();

  for (const sel of aecSelections) {
    const meta = sectionMeta(ctx, sel.offeringSectionId);
    if (!meta) return issue('OFFERING_NOT_FOUND', 'AEC section not found');
    if (!eligibility.allowedSlugs.includes(meta.subjectSlug)) {
      return issue(
        'AEC_INELIGIBLE',
        `Not eligible for AEC course ${meta.subjectSlug}`,
      );
    }
  }
  return ok();
};

export const courseEligibilityValidator: Validator = (ctx) => {
  const studentCtx = ctx.studentEligibilityContext;
  if (!studentCtx) return ok();

  for (const sel of ctx.selections) {
    if (sel.eligibilityOverride) continue;
    const meta = sectionMeta(ctx, sel.offeringSectionId);
    if (!meta) continue;
    const rules = normalizeCourseEligibilityRules(meta.eligibilityRules ?? {});
    if (isRulesEmpty(rules)) continue;

    const result = evaluateCourseEligibility(rules, studentCtx);
    if (!result.eligible) {
      return issue(
        'COURSE_INELIGIBLE',
        result.reasons[0] ?? `Not eligible for course ${meta.courseCode}`,
      );
    }
  }
  return ok();
};

export const prerequisiteValidator: Validator = (ctx) => {
  const confirmedOfferingIds = new Set(
    Object.values(ctx.priorConfirmedByCategory),
  );
  for (const sel of ctx.selections) {
    const meta = sectionMeta(ctx, sel.offeringSectionId);
    if (!meta)
      return issue(
        'OFFERING_NOT_FOUND',
        `Section ${sel.offeringSectionId} not found`,
      );
    for (const prereq of meta.prerequisiteOfferingIds) {
      if (!confirmedOfferingIds.has(prereq)) {
        return issue(
          'PREREQUISITE_MISSING',
          'Prerequisite course not completed',
        );
      }
    }
  }
  return ok();
};

export const selectionMetaValidator: Validator = (ctx) => {
  for (const sel of ctx.selections) {
    if (!isNepCategory(sel.category)) {
      return issue(
        'INVALID_CATEGORY',
        `Invalid category ${String(sel.category)}`,
      );
    }
    const meta = sectionMeta(ctx, sel.offeringSectionId);
    if (!meta)
      return issue(
        'OFFERING_NOT_FOUND',
        `Section ${sel.offeringSectionId} not found`,
      );
    if (meta.category !== sel.category) {
      if (!allowsFyugpCrossMajorMinor(ctx, sel, meta)) {
        return issue(
          'CATEGORY_OFFERING_MISMATCH',
          'Offering category does not match selection',
        );
      }
    }
    if (
      meta.semesterSequence !== null &&
      meta.semesterSequence !== ctx.semesterSequence
    ) {
      return issue(
        'WRONG_SEMESTER',
        'Offering is not available for this semester',
      );
    }
  }
  return ok();
};

export const mandatoryCategoryValidator: Validator = (ctx) => {
  for (const [category, requirement] of Object.entries(
    ctx.categoryRequirements,
  )) {
    if (!requirement.mandatory) continue;
    const selected = ctx.selections.filter(
      (s) => s.category === category,
    ).length;
    if (selected < requirement.count) {
      return issue(
        'MANDATORY_CATEGORY_MISSING',
        `Mandatory category ${category} requires ${requirement.count} selection(s)`,
      );
    }
  }
  return ok();
};

export const categoryCreditValidator: Validator = (ctx) => {
  const creditsByCategory: Record<string, number> = {};
  for (const sel of ctx.selections) {
    const meta = sectionMeta(ctx, sel.offeringSectionId);
    if (!meta) continue;
    creditsByCategory[sel.category] =
      (creditsByCategory[sel.category] ?? 0) + meta.courseCredits;
  }

  for (const [category, requirement] of Object.entries(
    ctx.categoryRequirements,
  )) {
    if (requirement.creditRule == null) continue;
    const expected = requirement.count * requirement.creditRule;
    const actual = creditsByCategory[category] ?? 0;
    if (actual !== expected) {
      return issue(
        'CATEGORY_CREDIT_MISMATCH',
        `${category} requires ${expected} credits (${requirement.count} × ${requirement.creditRule}), got ${actual}`,
      );
    }
    for (const sel of ctx.selections.filter((s) => s.category === category)) {
      const meta = sectionMeta(ctx, sel.offeringSectionId);
      if (meta && meta.courseCredits !== requirement.creditRule) {
        return issue(
          'COURSE_CREDIT_MISMATCH',
          `${category} course must be ${requirement.creditRule} credits (found ${meta.courseCredits})`,
        );
      }
    }
  }
  return ok();
};

export const semesterCreditTargetValidator: Validator = (ctx) => {
  if (ctx.totalDraftCredits !== ctx.semesterCreditTarget) {
    return issue(
      'SEMESTER_CREDIT_TARGET_MISMATCH',
      `Semester requires exactly ${ctx.semesterCreditTarget} credits, draft total is ${ctx.totalDraftCredits}`,
    );
  }
  return ok();
};

export const degreeCreditValidator: Validator = (ctx) => {
  const lifetimeConfirmed = Object.values(
    ctx.confirmedCreditsByCategory,
  ).reduce((sum, value) => sum + value, 0);
  const draftTotal = lifetimeConfirmed + ctx.totalDraftCredits;
  if (draftTotal > 0 && draftTotal < ctx.degreeMinCredits) {
    // informational during mid-programme registration; block only when attempting final completion
    return ok();
  }
  return ok();
};

export const creditRangeValidator: Validator = (ctx) => {
  const target = ctx.semesterCreditTarget;
  if (ctx.totalDraftCredits !== target) {
    return issue(
      'CREDITS_TARGET_MISMATCH',
      `Semester requires exactly ${target} credits (draft: ${ctx.totalDraftCredits})`,
    );
  }
  return ok();
};

export const duplicateSelectionValidator: Validator = (ctx) => {
  const seenSections = new Set<string>();
  const seenOfferings = new Set<string>();
  for (const sel of ctx.selections) {
    if (seenSections.has(sel.offeringSectionId)) {
      return issue('DUPLICATE_SECTION', 'Duplicate section selection');
    }
    seenSections.add(sel.offeringSectionId);
    if (seenOfferings.has(sel.offeringId)) {
      return issue('DUPLICATE_OFFERING', 'Duplicate course offering');
    }
    seenOfferings.add(sel.offeringId);
  }
  return ok();
};

export const duplicateMajorPaperValidator: Validator = (ctx) => {
  const majorSelections = ctx.selections.filter((s) => s.category === 'MAJOR');
  if (majorSelections.length === 0) return ok();

  const seenCourseIds = new Set<string>();
  for (const sel of majorSelections) {
    const meta = sectionMeta(ctx, sel.offeringSectionId);
    if (!meta) continue;
    if (seenCourseIds.has(meta.courseId)) {
      return issue(
        'DUPLICATE_MAJOR_PAPER',
        'Duplicate major paper assignment detected',
      );
    }
    seenCourseIds.add(meta.courseId);
  }
  return ok();
};

export const majorPaperCurriculumValidator: Validator = (ctx) => {
  const required = requiredMajorPaperCount(ctx.categoryCounts);
  if (required <= 1) return ok();

  const majorSelections = ctx.selections.filter((s) => s.category === 'MAJOR');
  if (majorSelections.length !== required) {
    return issue(
      'MAJOR_PAPER_COUNT_MISMATCH',
      `Expected ${required} unique MAJOR paper assignment(s), got ${majorSelections.length}`,
    );
  }

  const courseIds = new Set<string>();
  for (const sel of majorSelections) {
    const meta = sectionMeta(ctx, sel.offeringSectionId);
    if (!meta) {
      return issue(
        'OFFERING_NOT_FOUND',
        `Section ${sel.offeringSectionId} not found`,
      );
    }
    if (courseIds.has(meta.courseId)) {
      return issue(
        'DUPLICATE_MAJOR_PAPER',
        'Duplicate major paper assignment detected',
      );
    }
    courseIds.add(meta.courseId);
  }
  return ok();
};

export const streamEligibilityValidator: Validator = (ctx) => {
  if (!ctx.studentStreamId) {
    return issue(
      'STREAM_NOT_ASSIGNED',
      'Academic stream is not assigned to your profile',
    );
  }
  const failures: string[] = [];
  for (const sel of ctx.selections) {
    const meta = sectionMeta(ctx, sel.offeringSectionId);
    if (!meta) continue;
    if (
      !isStudentEligibleForSection(ctx.studentStreamId, meta.allowedStreamIds)
    ) {
      failures.push(
        formatStreamIneligibleMessage({
          courseCode: meta.courseCode,
          courseTitle: meta.courseTitle,
          category: meta.category,
          sectionCode: meta.sectionCode,
          studentStreamLabel: ctx.studentStreamLabel ?? ctx.studentStreamId,
          allowedStreamLabels: meta.allowedStreamLabels,
        }),
      );
    }
  }
  if (failures.length === 0) return ok();
  return issue('STREAM_INELIGIBLE', failures.join('\n'));
};

export const shiftEligibilityValidator: Validator = (ctx) => {
  if (!ctx.shiftPolicy.enforcePreferredShift || !ctx.preferredShiftId)
    return ok();
  for (const sel of ctx.selections) {
    const meta = sectionMeta(ctx, sel.offeringSectionId);
    if (meta && meta.shiftId !== ctx.preferredShiftId) {
      return issue(
        'SHIFT_MISMATCH',
        `Selection must be in your preferred shift (selected: ${meta.shiftCode})`,
      );
    }
  }
  return ok();
};

export const crossShiftConflictValidator: Validator = (ctx) => {
  if (!ctx.shiftPolicy.blockCrossShift) return ok();
  const shifts = new Set<string>();
  for (const sel of ctx.selections) {
    const meta = sectionMeta(ctx, sel.offeringSectionId);
    if (!meta) continue;
    shifts.add(meta.shiftId);
    if (shifts.size > 1) {
      return issue(
        'CROSS_SHIFT_CONFLICT',
        'All sections must be in the same shift',
      );
    }
  }
  return ok();
};

export const vacPolicyValidator: Validator = (ctx) => {
  if (!ctx.vacPolicy.mandatoryVacRequired) return ok();
  const hasVac = ctx.selections.some((s) => s.category === 'VAC');
  if (!hasVac)
    return issue('VAC_REQUIRED', 'Mandatory VAC selection is required');
  return ok();
};

export const seatAvailabilityValidator: Validator = (ctx) => {
  for (const sel of ctx.selections) {
    const meta = sectionMeta(ctx, sel.offeringSectionId);
    if (!meta) continue;
    const available = meta.capacity - meta.confirmedCount;
    if (available > 0) continue;
    const waitlistRemaining = meta.waitlistCapacity - meta.waitlistCount;
    if (waitlistRemaining <= 0) {
      return issue(
        'SECTION_FULL',
        `Section ${meta.sectionCode} (${meta.shiftCode}) is full with no waitlist capacity`,
      );
    }
  }
  return ok();
};

export const electiveOwnershipValidator: Validator = (ctx) => {
  const electiveCats = new Set(ctx.studentElectiveCategories ?? []);
  if (electiveCats.size === 0) return ok();
  if (
    ctx.registrationWorkflowMode === 'ADMIN_ONLY' ||
    !ctx.registrationWorkflowMode
  ) {
    return ok();
  }
  for (const sel of ctx.selections) {
    const requirement = ctx.categoryRequirements[sel.category];
    const mandatory = requirement?.mandatory ?? true;
    if (
      mandatory &&
      !ALWAYS_AUTO_ASSIGNED.has(sel.category) &&
      electiveCats.has(sel.category)
    ) {
      continue;
    }
  }
  return ok();
};

/** Stub until shift/timetable engine is integrated; clashes use warning severity. */
export const timetableConflictValidator: Validator = (ctx) => {
  if (ctx.selections.length < 2) return ok();
  // Timetable slots not yet in validation context — surface advisory only.
  return warning(
    'TIMETABLE_CHECK_DEFERRED',
    'Timetable clash detection is not yet enabled; confirm section times manually.',
  );
};

export const REGISTRATION_VALIDATORS: Validator[] = [
  registrationWindowValidator,
  semesterStructureValidator,
  mandatoryCategoryValidator,
  selectionMetaValidator,
  continuityValidator,
  majorMinorTrackValidator,
  vtcTrackValidator,
  categoryCreditValidator,
  semesterCreditTargetValidator,
  seatAvailabilityValidator,
  mdcConflictValidator,
  aecEligibilityValidator,
  courseEligibilityValidator,
  prerequisiteValidator,
  duplicateSelectionValidator,
  duplicateMajorPaperValidator,
  majorPaperCurriculumValidator,
  streamEligibilityValidator,
  shiftEligibilityValidator,
  crossShiftConflictValidator,
  vacPolicyValidator,
  electiveOwnershipValidator,
  degreeCreditValidator,
  timetableConflictValidator,
];

export function runValidators(
  ctx: RegistrationValidationContext,
  validators: Validator[] = REGISTRATION_VALIDATORS,
) {
  const issues: {
    code: string;
    message: string;
    severity: 'error' | 'warning';
  }[] = [];
  for (const v of validators) {
    const result = v(ctx);
    if (!result.ok) {
      issues.push({
        code: result.code,
        message: result.message,
        severity: result.severity,
      });
    }
  }
  return issues;
}

export function blockingValidationIssues(
  issues: ReturnType<typeof runValidators>,
) {
  return issues.filter((issue) => issue.severity !== 'warning');
}
