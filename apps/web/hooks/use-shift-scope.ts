'use client';

import { useMemo } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { useOptionalWorkspaceContext } from '@/providers/workspace-provider';
import { useWorkspaceStore } from '@/store/workspace-store';

export function useShiftScope() {
  const session = useAuthStore((s) => s.session);
  const user = session?.user;
  const workspace = useOptionalWorkspaceContext();
  const storeKind = useWorkspaceStore((s) => s.kind);
  const storeShiftId = useWorkspaceStore((s) => s.activeShiftId);
  const storeShiftCode = useWorkspaceStore((s) => s.activeShiftCode);
  const storeShiftName = useWorkspaceStore((s) => s.activeShiftName);

  return useMemo(() => {
    const allShifts = Boolean(user?.allShifts);
    const shiftIds = user?.shiftIds ?? [];
    const primaryShiftId = user?.primaryShiftId ?? shiftIds[0];
    const workspaceKind = workspace?.kind ?? storeKind;
    const workspaceShiftId = workspace?.activeShiftId ?? storeShiftId ?? undefined;
    const activeShiftCode = workspace?.activeShiftCode ?? storeShiftCode ?? undefined;
    const activeShiftName = workspace?.activeShiftName ?? storeShiftName ?? undefined;
    const activeShiftId =
      workspaceKind === 'institution' && allShifts
        ? undefined
        : (workspaceShiftId ?? primaryShiftId);

    return {
      allShifts,
      shiftIds,
      primaryShiftId,
      activeShiftId,
      activeShiftCode,
      activeShiftName,
      workspaceKind,
      hideShiftSelectors: workspace?.hideShiftSelectors ?? !allShifts,
      isShiftAdmin: user?.roles.some((r) => r.startsWith('shift-')),
    };
  }, [storeKind, storeShiftCode, storeShiftId, storeShiftName, user, workspace]);
}
