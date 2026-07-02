'use client';

import { createContext, useContext } from 'react';
import { useWorkspace, type WorkspaceContextValue } from '@/hooks/use-workspace';

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const value = useWorkspace();
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspaceContext() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspaceContext must be used within WorkspaceProvider');
  }
  return ctx;
}

/** Safe optional accessor for components outside admin shell. */
export function useOptionalWorkspaceContext() {
  return useContext(WorkspaceContext);
}
