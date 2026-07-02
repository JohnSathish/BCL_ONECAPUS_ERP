'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';
import { useWorkspaceStore } from '@/store/workspace-store';
import { fetchShifts } from '@/services/shifts';
import {
  canSwitchWorkspace,
  isShiftLockedUser,
  resolveLockedWorkspaceKind,
  resolveShiftForWorkspace,
} from '@/lib/workspace/workspace-utils';
import {
  WORKSPACE_ACCENTS,
  WORKSPACE_DEFINITIONS,
  type WorkspaceKind,
} from '@/lib/workspace/workspace-types';

export function useWorkspace() {
  const session = useAuthStore((s) => s.session);
  const user = session?.user;
  const hasHydrated = useWorkspaceStore((s) => s.hasHydrated);
  const kind = useWorkspaceStore((s) => s.kind);
  const activeShiftId = useWorkspaceStore((s) => s.activeShiftId);
  const activeShiftCode = useWorkspaceStore((s) => s.activeShiftCode);
  const activeShiftName = useWorkspaceStore((s) => s.activeShiftName);
  const hasSelectedWorkspace = useWorkspaceStore((s) => s.hasSelectedWorkspace);
  const boundUserId = useWorkspaceStore((s) => s.boundUserId);
  const setWorkspace = useWorkspaceStore((s) => s.setWorkspace);
  const clearWorkspace = useWorkspaceStore((s) => s.clearWorkspace);

  const shiftsQ = useQuery({
    queryKey: ['workspace', 'shifts'],
    queryFn: () => fetchShifts({ status: 'ACTIVE' }),
    enabled: Boolean(user),
    staleTime: 5 * 60_000,
  });

  const applyWorkspaceKind = useCallback(
    (nextKind: WorkspaceKind) => {
      const shifts = shiftsQ.data ?? [];
      const def = WORKSPACE_DEFINITIONS[nextKind];
      const shift = resolveShiftForWorkspace(nextKind, shifts);
      setWorkspace({
        kind: nextKind,
        activeShiftId: shift?.id ?? null,
        activeShiftCode: shift?.code ?? def.shiftCode ?? null,
        activeShiftName: shift?.name ?? null,
        hasSelectedWorkspace: true,
        boundUserId: user?.id ?? null,
      });
    },
    [setWorkspace, shiftsQ.data, user?.id],
  );

  useEffect(() => {
    if (!user || !hasHydrated) return;
    if (boundUserId && boundUserId !== user.id) {
      clearWorkspace();
    }
  }, [boundUserId, clearWorkspace, hasHydrated, user]);

  useEffect(() => {
    if (!user || !hasHydrated || !shiftsQ.isSuccess) return;
    if (isShiftLockedUser(user)) {
      const lockedKind = resolveLockedWorkspaceKind(user, shiftsQ.data ?? []);
      if (lockedKind) {
        const shift = resolveShiftForWorkspace(lockedKind, shiftsQ.data ?? []);
        setWorkspace({
          kind: lockedKind,
          activeShiftId: shift?.id ?? user.primaryShiftId ?? null,
          activeShiftCode: shift?.code ?? null,
          activeShiftName: shift?.name ?? null,
          hasSelectedWorkspace: true,
          boundUserId: user.id,
        });
      }
    }
  }, [hasHydrated, setWorkspace, shiftsQ.data, shiftsQ.isSuccess, user]);

  const mode = useMemo(() => WORKSPACE_DEFINITIONS[kind].mode, [kind]);
  const accent = WORKSPACE_ACCENTS[kind];
  const definition = WORKSPACE_DEFINITIONS[kind];
  const isShiftWorkspace = mode === 'shift' && Boolean(activeShiftId);
  const showShiftFilter = canSwitchWorkspace(user) && kind === 'institution';
  const showWorkspaceSwitcher = canSwitchWorkspace(user);
  const hideShiftSelectors =
    isShiftLockedUser(user) || (canSwitchWorkspace(user) && kind !== 'institution');

  return {
    user,
    kind,
    mode,
    definition,
    accent,
    activeShiftId,
    activeShiftCode,
    activeShiftName,
    hasSelectedWorkspace,
    isShiftWorkspace,
    showShiftFilter,
    showWorkspaceSwitcher,
    hideShiftSelectors,
    isShiftLocked: isShiftLockedUser(user),
    shifts: shiftsQ.data ?? [],
    shiftsLoading: shiftsQ.isLoading,
    setWorkspaceKind: applyWorkspaceKind,
    clearWorkspace,
  };
}

export type WorkspaceContextValue = ReturnType<typeof useWorkspace>;
