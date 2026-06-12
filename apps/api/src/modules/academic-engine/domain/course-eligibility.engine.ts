import {
  normalizeStreamCode,
  normalizeSlug,
  class12SubjectSlugs,
} from './course-eligibility.context';
import type {
  CourseEligibilityResult,
  CourseEligibilityRules,
  EligibilityStreamCode,
  StudentEligibilityContext,
} from './course-eligibility.types';
import { ELIGIBILITY_STREAM_CODES } from './course-eligibility.types';
import { slugifySubject } from './nep-categories';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function uniqueStrings(values: string[] | undefined): string[] {
  if (!values?.length) return [];
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

function uniqueSlugs(values: string[] | undefined): string[] {
  return uniqueStrings(values).map((v) => slugifySubject(v));
}

function uniqueStreamCodes(
  values: string[] | undefined,
): EligibilityStreamCode[] {
  if (!values?.length) return [];
  const allowed = new Set<string>(ELIGIBILITY_STREAM_CODES);
  const out: EligibilityStreamCode[] = [];
  for (const raw of values) {
    const code = raw.trim().toUpperCase();
    if (allowed.has(code) && !out.includes(code as EligibilityStreamCode)) {
      out.push(code as EligibilityStreamCode);
    }
  }
  return out;
}

function uniqueUuids(values: string[] | undefined): string[] {
  return uniqueStrings(values).filter((v) => UUID_RE.test(v));
}

function uniqueStreamCodesExcludingAll(
  values: string[] | undefined,
): EligibilityStreamCode[] {
  return uniqueStreamCodes(values).filter((code) => code !== 'ALL');
}

function normalizeClass12Exclusions(
  rows: CourseEligibilityRules['class12SubjectExclusions'],
) {
  if (!rows?.length) return [];
  return rows
    .map((row) => ({
      subjectSlug: slugifySubject(row.subjectSlug ?? ''),
      label: row.label?.trim() || undefined,
    }))
    .filter((row) => row.subjectSlug.length > 0);
}

function normalizePriorStudyExclusions(
  rows: CourseEligibilityRules['priorStudyExclusions'],
) {
  if (!rows?.length) return [];
  return rows
    .map((row) => ({
      subjectSlug: slugifySubject(row.subjectSlug ?? ''),
      semesterSequence:
        row.semesterSequence != null && row.semesterSequence > 0
          ? row.semesterSequence
          : undefined,
      category: row.category?.trim().toUpperCase() || undefined,
      label: row.label?.trim() || undefined,
    }))
    .filter((row) => row.subjectSlug.length > 0);
}

export function normalizeCourseEligibilityRules(
  raw: unknown,
): CourseEligibilityRules {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const input = raw as Record<string, unknown>;
  return {
    allowedStreams: uniqueStreamCodes(
      input.allowedStreams as string[] | undefined,
    ),
    excludedStreams: uniqueStreamCodesExcludingAll(
      input.excludedStreams as string[] | undefined,
    ),
    allowedProgramIds: uniqueUuids(
      input.allowedProgramIds as string[] | undefined,
    ),
    excludedProgramIds: uniqueUuids(
      input.excludedProgramIds as string[] | undefined,
    ),
    allowedProgramVersionIds: uniqueUuids(
      input.allowedProgramVersionIds as string[] | undefined,
    ),
    excludedProgramVersionIds: uniqueUuids(
      input.excludedProgramVersionIds as string[] | undefined,
    ),
    allowedMajorSubjectSlugs: uniqueSlugs(
      input.allowedMajorSubjectSlugs as string[] | undefined,
    ),
    excludedMajorSubjectSlugs: uniqueSlugs(
      input.excludedMajorSubjectSlugs as string[] | undefined,
    ),
    class12SubjectExclusions: normalizeClass12Exclusions(
      input.class12SubjectExclusions as CourseEligibilityRules['class12SubjectExclusions'],
    ),
    priorStudyExclusions: normalizePriorStudyExclusions(
      input.priorStudyExclusions as CourseEligibilityRules['priorStudyExclusions'],
    ),
  };
}

export function isRulesEmpty(rules: CourseEligibilityRules): boolean {
  return (
    !rules.allowedStreams?.length &&
    !rules.excludedStreams?.length &&
    !rules.allowedProgramIds?.length &&
    !rules.excludedProgramIds?.length &&
    !rules.allowedProgramVersionIds?.length &&
    !rules.excludedProgramVersionIds?.length &&
    !rules.allowedMajorSubjectSlugs?.length &&
    !rules.excludedMajorSubjectSlugs?.length &&
    !rules.class12SubjectExclusions?.length &&
    !rules.priorStudyExclusions?.length
  );
}

export function formatEligibilityReason(code: string, detail?: string): string {
  switch (code) {
    case 'STREAM_NOT_ALLOWED':
      return detail ?? 'Student stream is not allowed for this course';
    case 'STREAM_EXCLUDED':
      return detail ?? 'Student stream is excluded from this course';
    case 'PROGRAM_VERSION_EXCLUDED':
      return detail ?? 'Student programme version is excluded';
    case 'PROGRAM_EXCLUDED':
      return detail ?? 'Student programme is excluded';
    case 'PROGRAM_VERSION_NOT_ALLOWED':
      return detail ?? 'Student programme version is not in the allowed list';
    case 'PROGRAM_NOT_ALLOWED':
      return detail ?? 'Student programme is not in the allowed list';
    case 'MAJOR_EXCLUDED':
      return detail ?? 'Student major subject is excluded';
    case 'MAJOR_NOT_ALLOWED':
      return detail ?? 'Student major subject is not in the allowed list';
    case 'CLASS12_SUBJECT_EXCLUDED':
      return detail ?? 'Excluded due to Class XII subject background';
    case 'PRIOR_STUDY_EXCLUDED':
      return detail ?? 'Excluded due to prior study';
    default:
      return detail ?? 'Not eligible for this course';
  }
}

function fail(
  code: string,
  detail?: string,
): Pick<CourseEligibilityResult, 'eligible' | 'reasons' | 'codes'> {
  return {
    eligible: false,
    reasons: [formatEligibilityReason(code, detail)],
    codes: [code],
  };
}

function passesStream(
  rules: CourseEligibilityRules,
  ctx: StudentEligibilityContext,
): Pick<CourseEligibilityResult, 'eligible' | 'reasons' | 'codes'> | null {
  const streamCode = normalizeStreamCode(ctx.streamCode);

  const allowed = rules.allowedStreams;
  if (allowed?.length && !allowed.includes('ALL')) {
    if (!streamCode) {
      return fail(
        'STREAM_NOT_ALLOWED',
        `This course requires one of: ${allowed.join(', ')}`,
      );
    }
    if (!allowed.includes(streamCode as EligibilityStreamCode)) {
      return fail(
        'STREAM_NOT_ALLOWED',
        `Course is restricted to ${allowed.join(', ')} streams; student is ${streamCode}`,
      );
    }
  }

  const excluded = rules.excludedStreams;
  if (excluded?.length && streamCode) {
    if (excluded.includes(streamCode as EligibilityStreamCode)) {
      const label = streamCode.charAt(0) + streamCode.slice(1).toLowerCase();
      return fail(
        'STREAM_EXCLUDED',
        `${label} students cannot take this subject`,
      );
    }
  }

  return null;
}

function passesProgramme(
  rules: CourseEligibilityRules,
  ctx: StudentEligibilityContext,
): Pick<CourseEligibilityResult, 'eligible' | 'reasons' | 'codes'> | null {
  if (
    ctx.programVersionId &&
    rules.excludedProgramVersionIds?.includes(ctx.programVersionId)
  ) {
    return fail('PROGRAM_VERSION_EXCLUDED');
  }
  if (ctx.programId && rules.excludedProgramIds?.includes(ctx.programId)) {
    return fail('PROGRAM_EXCLUDED');
  }

  if (rules.allowedProgramVersionIds?.length) {
    if (
      !ctx.programVersionId ||
      !rules.allowedProgramVersionIds.includes(ctx.programVersionId)
    ) {
      return fail('PROGRAM_VERSION_NOT_ALLOWED');
    }
  } else if (rules.allowedProgramIds?.length) {
    if (!ctx.programId || !rules.allowedProgramIds.includes(ctx.programId)) {
      return fail('PROGRAM_NOT_ALLOWED');
    }
  }
  return null;
}

function passesMajor(
  rules: CourseEligibilityRules,
  ctx: StudentEligibilityContext,
): Pick<CourseEligibilityResult, 'eligible' | 'reasons' | 'codes'> | null {
  const major = normalizeSlug(ctx.majorSubjectSlug);
  if (major && rules.excludedMajorSubjectSlugs?.includes(major)) {
    return fail(
      'MAJOR_EXCLUDED',
      `Students with ${major} major cannot take this course`,
    );
  }
  if (rules.allowedMajorSubjectSlugs?.length) {
    if (!major || !rules.allowedMajorSubjectSlugs.includes(major)) {
      return fail(
        'MAJOR_NOT_ALLOWED',
        `Course is restricted to majors: ${rules.allowedMajorSubjectSlugs.join(', ')}`,
      );
    }
  }
  return null;
}

function passesClass12(
  rules: CourseEligibilityRules,
  ctx: StudentEligibilityContext,
): Pick<CourseEligibilityResult, 'eligible' | 'reasons' | 'codes'> | null {
  const exclusions = rules.class12SubjectExclusions;
  if (!exclusions?.length) return null;

  const studentSlugs = class12SubjectSlugs(ctx.class12Subjects);
  for (const exclusion of exclusions) {
    if (studentSlugs.has(exclusion.subjectSlug)) {
      const label = exclusion.label ?? exclusion.subjectSlug;
      return fail(
        'CLASS12_SUBJECT_EXCLUDED',
        `Excluded because Class XII includes ${label}`,
      );
    }
  }
  return null;
}

function passesPriorStudy(
  rules: CourseEligibilityRules,
  ctx: StudentEligibilityContext,
): Pick<CourseEligibilityResult, 'eligible' | 'reasons' | 'codes'> | null {
  const exclusions = rules.priorStudyExclusions;
  if (!exclusions?.length) return null;

  for (const exclusion of exclusions) {
    const match = ctx.completedStudy.find((record) => {
      if (record.subjectSlug !== exclusion.subjectSlug) return false;
      if (
        exclusion.semesterSequence != null &&
        record.semesterSequence !== exclusion.semesterSequence
      ) {
        return false;
      }
      if (exclusion.category && record.category !== exclusion.category) {
        return false;
      }
      return true;
    });
    if (match) {
      const label = exclusion.label ?? exclusion.subjectSlug;
      const sem =
        exclusion.semesterSequence != null
          ? ` in semester ${exclusion.semesterSequence}`
          : '';
      return fail(
        'PRIOR_STUDY_EXCLUDED',
        `Excluded because student already studied ${label}${sem}`,
      );
    }
  }
  return null;
}

export function evaluateCourseEligibility(
  rawRules: unknown,
  ctx: StudentEligibilityContext,
): CourseEligibilityResult {
  const rules = normalizeCourseEligibilityRules(rawRules);
  if (isRulesEmpty(rules)) {
    return { eligible: true, reasons: [], codes: [] };
  }

  const checks = [
    passesStream(rules, ctx),
    passesProgramme(rules, ctx),
    passesMajor(rules, ctx),
    passesClass12(rules, ctx),
    passesPriorStudy(rules, ctx),
  ];

  const failures = checks.filter(
    (result): result is NonNullable<typeof result> => result != null,
  );
  if (failures.length === 0) {
    return { eligible: true, reasons: [], codes: [] };
  }

  return {
    eligible: false,
    reasons: failures.flatMap((f) => f.reasons),
    codes: failures.flatMap((f) => f.codes),
  };
}

export function isCourseEligibleForStudent(
  rawRules: unknown,
  ctx: StudentEligibilityContext,
): boolean {
  return evaluateCourseEligibility(rawRules, ctx).eligible;
}
