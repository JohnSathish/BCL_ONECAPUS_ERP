'use client';

const STORAGE_PREFIX = 'nep-form-draft:';

export function formDraftKey(parts: string[]): string {
  return `${STORAGE_PREFIX}${parts.filter(Boolean).join(':')}`;
}

export function saveFormDraft<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify({ savedAt: new Date().toISOString(), data }));
  } catch {
    /* quota exceeded */
  }
}

export function loadFormDraft<T>(key: string): { savedAt: string; data: T } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt: string; data: T };
    if (!parsed?.data) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearFormDraft(key: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(key);
}
