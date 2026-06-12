import { DRAFT_STORAGE_KEY } from '@/components/staff-module/add-staff/constants';
import {
  createEmptyDraft,
  type AddStaffDraft,
} from '@/components/staff-module/add-staff/types/draft';
import {
  isEphemeralPhotoUrl,
  isPersistablePhotoUrl,
} from '@/components/students-module/add-student/utils/photo-utils';

function stripEphemeralDraftFields(draft: AddStaffDraft): AddStaffDraft {
  const photoPreviewUrl = isEphemeralPhotoUrl(draft.photoPreviewUrl)
    ? ''
    : isPersistablePhotoUrl(draft.photoPreviewUrl)
      ? draft.photoPreviewUrl
      : (draft.photoPreviewUrl ?? '');

  return { ...draft, photoPreviewUrl };
}

export function saveDraftToStorage(draft: AddStaffDraft) {
  if (typeof window === 'undefined') return;
  const payload = { ...stripEphemeralDraftFields(draft), draftSavedAt: new Date().toISOString() };
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ ...payload, photoPreviewUrl: '' }));
  }
}

export function loadDraftFromStorage(): AddStaffDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    return stripEphemeralDraftFields(JSON.parse(raw) as AddStaffDraft);
  } catch {
    return null;
  }
}

export function clearDraftStorage() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(DRAFT_STORAGE_KEY);
}

export function mergeWithEmptyDraft(partial: Partial<AddStaffDraft>): AddStaffDraft {
  return { ...createEmptyDraft(), ...partial };
}

export function hasRecoverableDraft(draft: AddStaffDraft | null | undefined): boolean {
  if (!draft) return false;
  return Boolean(
    draft.fullName?.trim() ||
    draft.email?.trim() ||
    draft.employeeCode?.trim() ||
    draft.mobile?.trim() ||
    draft.departmentId,
  );
}

export function isPristineDraft(draft: AddStaffDraft): boolean {
  return !hasRecoverableDraft(draft);
}
