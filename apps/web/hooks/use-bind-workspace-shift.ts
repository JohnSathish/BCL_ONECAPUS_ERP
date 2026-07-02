'use client';

import { useEffect } from 'react';
import { useShiftScope } from '@/hooks/use-shift-scope';

/** Sync local shift filter state to the active workspace shift when selectors are hidden. */
export function useBindWorkspaceShift(
  currentValue: string | undefined,
  onBind: (shiftId: string) => void,
) {
  const { hideShiftSelectors, activeShiftId } = useShiftScope();

  useEffect(() => {
    if (hideShiftSelectors && activeShiftId && currentValue !== activeShiftId) {
      onBind(activeShiftId);
    }
  }, [activeShiftId, currentValue, hideShiftSelectors, onBind]);
}

/** Resolve the shift id sent to APIs — workspace wins when shift selectors are locked. */
export function useEffectiveShiftId(localShiftId?: string): string | undefined {
  const { hideShiftSelectors, activeShiftId } = useShiftScope();
  if (hideShiftSelectors && activeShiftId) return activeShiftId;
  return localShiftId || undefined;
}
