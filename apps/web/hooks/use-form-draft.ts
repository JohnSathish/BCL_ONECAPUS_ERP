'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearFormDraft,
  formDraftKey,
  loadFormDraft,
  saveFormDraft,
} from '@/lib/form-drafts/form-draft-store';

type Options<T> = {
  keyParts: string[];
  values: T;
  enabled?: boolean;
  debounceMs?: number;
  /** When false, do not auto-save (e.g. pristine form after save). */
  isDirty?: boolean;
  onRestore?: (data: T) => void;
};

export function useFormDraft<T>({
  keyParts,
  values,
  enabled = true,
  debounceMs = 3000,
  isDirty = true,
  onRestore,
}: Options<T>) {
  const key = formDraftKey(keyParts);
  const restoredRef = useRef(false);
  const wasEnabledRef = useRef(false);
  const onRestoreRef = useRef(onRestore);
  const [draftRestored, setDraftRestored] = useState(false);

  onRestoreRef.current = onRestore;

  useEffect(() => {
    if (!enabled) {
      wasEnabledRef.current = false;
      return;
    }

    // Only offer restore the first time this tab/form becomes active per page visit.
    if (wasEnabledRef.current || restoredRef.current || !onRestoreRef.current) {
      wasEnabledRef.current = true;
      return;
    }
    wasEnabledRef.current = true;

    const draft = loadFormDraft<T>(key);
    if (!draft) return;

    restoredRef.current = true;
    const accept = window.confirm('Restore unsaved draft from your last session?');
    if (accept) {
      onRestoreRef.current(draft.data);
      setDraftRestored(true);
    } else {
      clearFormDraft(key);
    }
  }, [enabled, key]);

  useEffect(() => {
    if (!enabled || !isDirty) return;
    const timer = setTimeout(() => {
      saveFormDraft(key, values);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [enabled, isDirty, key, values, debounceMs]);

  const clearDraft = useCallback(() => {
    clearFormDraft(key);
    restoredRef.current = true;
  }, [key]);

  return {
    clearDraft,
    draftRestored,
  };
}
