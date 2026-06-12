'use client';

import { useEffect, useRef } from 'react';
import { setGlobalUnsavedChanges } from '@/lib/auth/unsaved-changes-registry';

type Options = {
  isDirty: boolean;
  message?: string;
  enabled?: boolean;
};

const DEFAULT_MESSAGE = 'You have unsaved changes.';

export function useUnsavedChangesGuard({
  isDirty,
  message = DEFAULT_MESSAGE,
  enabled = true,
}: Options) {
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  useEffect(() => {
    if (!enabled) {
      setGlobalUnsavedChanges(false);
      return;
    }
    setGlobalUnsavedChanges(isDirty);
    return () => setGlobalUnsavedChanges(false);
  }, [enabled, isDirty]);

  useEffect(() => {
    if (!enabled) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) return;
      event.preventDefault();
      event.returnValue = message;
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [enabled, message]);

  return {
    confirmDiscard: () => {
      if (!enabled || !isDirtyRef.current) return true;
      return window.confirm(message);
    },
  };
}
