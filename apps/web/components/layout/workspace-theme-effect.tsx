'use client';

import { useEffect } from 'react';
import { useOptionalWorkspaceContext } from '@/providers/workspace-provider';
import { WORKSPACE_ACCENTS } from '@/lib/workspace/workspace-types';

export function WorkspaceThemeEffect() {
  const workspace = useOptionalWorkspaceContext();
  const kind = workspace?.kind ?? 'institution';

  useEffect(() => {
    const root = document.documentElement;
    const accent = WORKSPACE_ACCENTS[kind];
    root.style.setProperty('--workspace-accent', accent.cssVar);
    return () => {
      root.style.removeProperty('--workspace-accent');
    };
  }, [kind]);

  return null;
}
