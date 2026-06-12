import { DRAFT_STORAGE_KEY } from '@/components/students-module/add-student/constants';

import {
  createEmptyDraft,
  type AddStudentDraft,
} from '@/components/students-module/add-student/types/draft';

import {
  isEphemeralPhotoUrl,
  isPersistablePhotoUrl,
} from '@/components/students-module/add-student/utils/photo-utils';

function stripEphemeralDraftFields(draft: AddStudentDraft): AddStudentDraft {
  const photoPreviewUrl = isEphemeralPhotoUrl(draft.photoPreviewUrl)
    ? ''
    : isPersistablePhotoUrl(draft.photoPreviewUrl)
      ? draft.photoPreviewUrl
      : (draft.photoPreviewUrl ?? '');

  return {
    ...draft,

    photoPreviewUrl,
  };
}

export function saveDraftToStorage(draft: AddStudentDraft) {
  if (typeof window === 'undefined') return;

  const payload = {
    ...stripEphemeralDraftFields(draft),

    draftSavedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    localStorage.setItem(
      DRAFT_STORAGE_KEY,

      JSON.stringify({
        ...payload,

        photoPreviewUrl: '',
      }),
    );
  }
}

export function loadDraftFromStorage(): AddStudentDraft | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);

    if (!raw) return null;

    return stripEphemeralDraftFields(JSON.parse(raw) as AddStudentDraft);
  } catch {
    return null;
  }
}

export function clearDraftStorage() {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(DRAFT_STORAGE_KEY);
}

export function mergeWithEmptyDraft(partial: Partial<AddStudentDraft>): AddStudentDraft {
  const base = { ...createEmptyDraft(), ...partial };

  const placeholderPattern = /^Subject \d+$/;
  const hasPlaceholderMarks = base.subjectMarks.some((m) =>
    placeholderPattern.test(m.subjectName.trim()),
  );

  if (
    base.class12Subjects.length === 0 &&
    base.subjectMarks.some(
      (m) => m.subjectName.trim() && !placeholderPattern.test(m.subjectName.trim()),
    )
  ) {
    base.class12Subjects = base.subjectMarks
      .filter((m) => m.subjectName.trim() && !placeholderPattern.test(m.subjectName.trim()))
      .map((m) => ({ name: m.subjectName.trim() }));
  }

  if (hasPlaceholderMarks && base.class12Subjects.length > 0) {
    base.subjectMarks = base.subjectMarks.filter(
      (m) => !placeholderPattern.test(m.subjectName.trim()),
    );
  }

  base.pendingDocuments = base.pendingDocuments.map((doc, index) => ({
    ...doc,
    id: doc.id || `restored-${index}-${doc.fileName}`,
  }));

  return base;
}

/** True when a stored draft has enough data to offer "Resume draft". */

export function hasRecoverableDraft(draft: AddStudentDraft | null | undefined): boolean {
  if (!draft) return false;

  return Boolean(
    draft.fullName?.trim() ||
    draft.email?.trim() ||
    draft.enrollmentNumber?.trim() ||
    draft.mobileNumber?.trim() ||
    draft.programVersionId ||
    draft.admissionBatchId,
  );
}

/** True for a blank wizard before the user enters student details. */

export function isPristineDraft(draft: AddStudentDraft): boolean {
  return !hasRecoverableDraft(draft);
}
