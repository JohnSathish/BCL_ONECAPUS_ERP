'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WorkspaceKind } from '@/lib/workspace/workspace-types';

type WorkspacePersisted = {
  kind: WorkspaceKind;
  activeShiftId: string | null;
  activeShiftCode: string | null;
  activeShiftName: string | null;
  hasSelectedWorkspace: boolean;
  /** Clears persisted workspace when a different user signs in. */
  boundUserId: string | null;
};

type WorkspaceState = WorkspacePersisted & {
  hasHydrated: boolean;
  setWorkspace: (patch: Partial<WorkspacePersisted>) => void;
  clearWorkspace: () => void;
  setHasHydrated: (value: boolean) => void;
};

const DEFAULT_STATE: WorkspacePersisted = {
  kind: 'institution',
  activeShiftId: null,
  activeShiftCode: null,
  activeShiftName: null,
  hasSelectedWorkspace: false,
  boundUserId: null,
};

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      ...DEFAULT_STATE,
      hasHydrated: false,
      setWorkspace: (patch) => set((state) => ({ ...state, ...patch })),
      clearWorkspace: () => set({ ...DEFAULT_STATE, hasHydrated: true }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: 'nep-erp-workspace',
      partialize: (state) => ({
        kind: state.kind,
        activeShiftId: state.activeShiftId,
        activeShiftCode: state.activeShiftCode,
        activeShiftName: state.activeShiftName,
        hasSelectedWorkspace: state.hasSelectedWorkspace,
        boundUserId: state.boundUserId,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);

/** Non-hook accessor for HTTP interceptors. */
export function getWorkspaceShiftHeader(): string | undefined {
  const state = useWorkspaceStore.getState();
  if (state.kind === 'institution') return undefined;
  return state.activeShiftId ?? undefined;
}

export function getWorkspaceKind(): WorkspaceKind {
  return useWorkspaceStore.getState().kind;
}
