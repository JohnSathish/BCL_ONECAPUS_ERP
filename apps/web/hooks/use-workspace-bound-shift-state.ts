'use client';

import { useCallback, useState } from 'react';
import { useBindWorkspaceShift, useEffectiveShiftId } from '@/hooks/use-bind-workspace-shift';
import { useShiftScope } from '@/hooks/use-shift-scope';

/** Local shift filter state bound to the active Morning/Day workspace. */
export function useWorkspaceBoundShiftState(initial = '') {
  const [shiftId, setShiftId] = useState(initial);
  const { hideShiftSelectors, activeShiftName, activeShiftCode } = useShiftScope();

  const bindShift = useCallback((id: string) => {
    setShiftId((current) => (current === id ? current : id));
  }, []);

  useBindWorkspaceShift(shiftId || undefined, bindShift);
  const effectiveShiftId = useEffectiveShiftId(shiftId || undefined);

  return {
    shiftId,
    setShiftId,
    effectiveShiftId,
    hideShiftFilter: hideShiftSelectors,
    workspaceShiftLabel: activeShiftName ?? activeShiftCode,
  };
}
