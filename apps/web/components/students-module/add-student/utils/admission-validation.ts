import { z } from 'zod';

import type { StepId } from '@/components/students-module/add-student/constants';
import type { AddStudentDraft } from '@/components/students-module/add-student/types/draft';
import { parseIsoDate } from '@/utils/format-date';
import {
  validateNehuRollNumber,
  validateNehuRegistrationNumber,
} from '@/components/students-module/add-student/constants/nehu-fields';
import { validateCollegeRollNumber } from '@/components/students-module/add-student/constants/roll-number-fields';

const mobileRegex = /^[6-9]\d{9}$/;
const aadhaarRegex = /^\d{12}$/;
const abcIdRegex = /^[A-Za-z0-9]+$/;

export const basicStepSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required. Minimum 2 characters.'),
  email: z.string().trim().email('Enter a valid email address.'),
  enrollmentNumber: z
    .string()
    .optional()
    .refine(
      (v) => !v?.trim() || /^[A-Za-z0-9/-]{2,32}$/.test(v.trim()),
      'NEHU Registration Number: use letters, numbers, / or - only (2–32 characters).',
    ),
  nehuRollNumber: z
    .string()
    .optional()
    .refine(
      (v) => !v?.trim() || /^[A-Za-z0-9/-]{2,24}$/.test(v.trim()),
      'NEHU Roll Number: 2–24 characters (letters, numbers, / or -).',
    ),
  mobileNumber: z
    .string()
    .trim()
    .min(1, 'Mobile number is required.')
    .refine(
      (v) => mobileRegex.test(v.replace(/\s/g, '')),
      'Enter a valid 10-digit mobile number starting with 6–9.',
    ),
  abcId: z
    .string()
    .optional()
    .refine(
      (v) => !v?.trim() || (abcIdRegex.test(v.trim()) && v.trim().length <= 50),
      'ABC ID must be alphanumeric (max 50 characters).',
    ),
  nationalId: z
    .string()
    .optional()
    .refine((v) => !v || aadhaarRegex.test(v.replace(/\s/g, '')), 'Aadhaar must be 12 digits.'),
  dateOfBirth: z.string().optional(),
});

export const academicStepSchema = z.object({
  programVersionId: z.string().min(1, 'Select a programme.'),
  admissionBatchId: z.string().min(1, 'Select an admission batch.'),
  streamId: z.string().min(1, 'Select a stream.'),
  primaryShiftId: z.string().min(1, 'Select a shift.'),
  majorSubjectSlug: z.string().optional(),
  minorSubjectSlug: z.string().optional(),
});

export const class12BackgroundSchema = z.object({
  boardName: z.string().trim().min(1, 'Board name is required.'),
  schoolName: z.string().trim().min(1, 'School name is required.'),
  examYear: z.coerce.number('Passing year is required.').int().min(1990),
  boardStream: z.string().trim().min(1, 'Select Class XII stream.'),
  class12Subjects: z
    .array(z.object({ name: z.string().trim().min(1) }))
    .min(1, 'Select at least one Class XII subject.'),
});

export function capitalizeName(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function validateAge(dob: string): string | null {
  if (!dob) return null;
  const birth = parseIsoDate(dob);
  if (!birth) return 'Invalid date of birth. Use dd/mm/yyyy.';
  const age = Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 3600 * 1000));
  if (age < 15) return 'Student must be at least 15 years old.';
  if (age > 60) return 'Student age exceeds maximum (60).';
  return null;
}

export function isClass12BackgroundComplete(draft: AddStudentDraft): boolean {
  return (
    class12BackgroundSchema.safeParse({
      boardName: draft.boardName,
      schoolName: draft.schoolName,
      examYear: draft.examYear,
      boardStream: draft.boardStream,
      class12Subjects: draft.class12Subjects,
    }).success &&
    (draft.overallMarks != null || draft.overallPercentage != null)
  );
}

export function validateClass12Background(draft: AddStudentDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  const parsed = class12BackgroundSchema.safeParse({
    boardName: draft.boardName,
    schoolName: draft.schoolName,
    examYear: draft.examYear,
    boardStream: draft.boardStream,
    class12Subjects: draft.class12Subjects,
  });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors[String(issue.path[0] ?? 'class12')] = issue.message;
    }
  }
  if (draft.overallMarks == null && draft.overallPercentage == null) {
    errors.overallMarks = 'Enter overall marks or overall percentage.';
  }
  return errors;
}

function draftNeedsMinor(draft: AddStudentDraft, opts?: { requireMinor?: boolean }): boolean {
  if (opts?.requireMinor === false) return false;
  if (opts?.requireMinor === true) return true;
  if (draft.subjectBasketMeta.minorRequired != null) {
    return draft.subjectBasketMeta.minorRequired;
  }
  return (draft.currentSemester ?? 1) <= 2;
}

export function validateStepFields(
  step: StepId,
  draft: AddStudentDraft,
  opts?: { requireMajor?: boolean; requireMinor?: boolean },
): Record<string, string> {
  const errors: Record<string, string> = {};
  const needsMinor = draftNeedsMinor(draft, opts);

  if (step === 'basic') {
    const parsed = basicStepSchema.safeParse(draft);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        errors[key] = issue.message;
      }
    }
    const ageErr = validateAge(draft.dateOfBirth);
    if (ageErr) errors.dateOfBirth = ageErr;
    const nehuRegErr = validateNehuRegistrationNumber(draft.enrollmentNumber);
    if (nehuRegErr) errors.enrollmentNumber = nehuRegErr;
    const nehuRollErr = validateNehuRollNumber(draft.nehuRollNumber);
    if (nehuRollErr) errors.nehuRollNumber = nehuRollErr;
    if (!draft.rollNumberAutoGenerated) {
      const rollErr = validateCollegeRollNumber(draft.rollNumber);
      if (rollErr) errors.rollNumber = rollErr;
    }
  }

  if (step === 'academic') {
    const parsed = academicStepSchema.safeParse(draft);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors[String(issue.path[0] ?? 'form')] = issue.message;
      }
    }
    if (opts?.requireMajor && !draft.majorSubjectSlug) {
      errors.majorSubjectSlug = 'Select a major subject.';
    }
    if (needsMinor && !draft.minorSubjectSlug) {
      errors.minorSubjectSlug = 'Select a minor subject.';
    }
    Object.assign(errors, validateClass12Background(draft));
  }

  if (step === 'fyugp') {
    if (!isClass12BackgroundComplete(draft)) {
      errors.class12Subjects = 'Complete Class XII Academic Background on the Academic step first.';
    } else if (!draft.majorSubjectSlug) {
      errors.subjectSelections = 'Set major subject path in Academic Details first.';
    } else if (needsMinor && !draft.minorSubjectSlug) {
      errors.subjectSelections = 'Set major and minor subject paths in Academic Details first.';
    } else {
      const missing = draft.subjectBasketMeta.missingPoolCategories ?? [];
      if (missing.length > 0) {
        errors.subjectSelections = `Select subjects for: ${missing.join(', ')}.`;
      }
    }
  }

  if (step === 'review') {
    const target = draft.subjectBasketMeta.creditsTarget ?? 0;
    const selected = draft.subjectBasketMeta.creditsSelected ?? 0;
    if (target > 0 && selected !== target) {
      errors.credits = `Semester must total exactly ${target} credits (currently ${selected}). Adjust pool subjects on the Subjects step — some courses may carry extra credits.`;
    }
    const missing = draft.subjectBasketMeta.missingPoolCategories ?? [];
    if (missing.length > 0) {
      errors.subjectSelections = `Complete pool selections: ${missing.join(', ')}.`;
    }
  }

  return errors;
}

export function validateAdmissionSubmit(
  draft: AddStudentDraft,
  mode: 'NONE' | 'DRAFT' | 'SUBMIT',
  apiValidationIssues: string[] = [],
): Record<string, string> {
  const needsMinor = draftNeedsMinor(draft);
  const errors = {
    ...validateStepFields('basic', draft),
    ...validateStepFields('academic', draft, {
      requireMajor: true,
      requireMinor: needsMinor,
    }),
  };

  if (mode !== 'NONE') {
    Object.assign(
      errors,
      validateStepFields('fyugp', draft, { requireMajor: true, requireMinor: needsMinor }),
    );
    Object.assign(errors, validateStepFields('review', draft));

    if (mode === 'SUBMIT' && apiValidationIssues.length > 0) {
      errors.subjectSelections = apiValidationIssues[0] ?? 'Subject basket validation failed.';
      if (apiValidationIssues.length > 1) {
        errors.eligibility = apiValidationIssues.slice(1).join(' ');
      }
    }
  }

  return errors;
}

export function firstStepError(errors: Record<string, string>): string | null {
  const values = Object.values(errors);
  return values[0] ?? null;
}
