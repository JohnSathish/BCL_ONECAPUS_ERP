import type {
  Class12SubjectRecord,
  CompletedStudyRecord,
  StudentEligibilityContext,
} from './course-eligibility.types';
import { slugifySubject } from './nep-categories';

export type DraftEligibilityContextInput = {
  programVersionId?: string;
  programId?: string;
  streamId?: string;
  streamCode?: string | null;
  majorSubjectSlug?: string | null;
  minorSubjectSlug?: string | null;
  class12Subjects?: Class12SubjectRecord[];
  completedStudy?: CompletedStudyRecord[];
};

export function buildEligibilityContext(
  input: DraftEligibilityContextInput,
): StudentEligibilityContext {
  return {
    programId: input.programId ?? null,
    programVersionId: input.programVersionId ?? null,
    streamCode: normalizeStreamCode(input.streamCode),
    majorSubjectSlug: normalizeSlug(input.majorSubjectSlug),
    minorSubjectSlug: normalizeSlug(input.minorSubjectSlug),
    class12Subjects: input.class12Subjects ?? [],
    completedStudy: input.completedStudy ?? [],
  };
}

export function normalizeStreamCode(value?: string | null): string | null {
  if (!value?.trim()) return null;
  return value.trim().toUpperCase();
}

export function normalizeSlug(value?: string | null): string | null {
  if (!value?.trim()) return null;
  return slugifySubject(value.trim());
}

export function class12SubjectSlugs(
  subjects: Class12SubjectRecord[],
): Set<string> {
  const slugs = new Set<string>();
  for (const subject of subjects) {
    if (subject.name?.trim()) {
      slugs.add(slugifySubject(subject.name));
    }
    if (subject.code?.trim()) {
      slugs.add(slugifySubject(subject.code));
    }
  }
  return slugs;
}
