'use client';

import { Building2, Sun, Sunrise } from 'lucide-react';
import { useWorkspaceContext } from '@/providers/workspace-provider';
import {
  WORKSPACE_ACCENTS,
  WORKSPACE_DEFINITIONS,
  type WorkspaceKind,
} from '@/lib/workspace/workspace-types';
import { cn } from '@/utils/cn';

const ICONS: Record<WorkspaceKind, typeof Building2> = {
  institution: Building2,
  morning: Sunrise,
  day: Sun,
};

export function WorkspaceSwitcher() {
  const { kind, setWorkspaceKind, showWorkspaceSwitcher } = useWorkspaceContext();
  if (!showWorkspaceSwitcher) return null;

  const kinds: WorkspaceKind[] = ['institution', 'morning', 'day'];

  return (
    <div
      className="hidden items-center gap-0.5 rounded-xl border border-border/80 bg-card/80 p-0.5 lg:flex"
      role="group"
      aria-label="Switch workspace"
    >
      {kinds.map((item) => {
        const Icon = ICONS[item];
        const accent = WORKSPACE_ACCENTS[item];
        const active = kind === item;
        return (
          <button
            key={item}
            type="button"
            onClick={() => setWorkspaceKind(item)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition',
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
            )}
            style={active ? { boxShadow: `inset 0 -2px 0 ${accent.cssVar}` } : undefined}
            title={WORKSPACE_DEFINITIONS[item].title}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{accent.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function WorkspaceBanner() {
  const { kind, definition, accent, activeShiftName, showWorkspaceSwitcher } =
    useWorkspaceContext();
  if (!showWorkspaceSwitcher && kind === 'institution') return null;

  const shiftLabel =
    kind === 'institution' ? 'All shifts' : (activeShiftName ?? definition.subtitle);

  return (
    <div
      className="hidden min-w-0 flex-col justify-center border-r border-border/60 pr-3 md:flex lg:max-w-[420px]"
      style={{ borderLeftWidth: 3, borderLeftColor: accent.cssVar, paddingLeft: 12 }}
    >
      <p className="truncate text-sm font-semibold leading-tight">{definition.title}</p>
      <p className="truncate text-[11px] text-muted-foreground">
        {shiftLabel}
        {kind !== 'institution' ? ' · Active' : ''}
      </p>
    </div>
  );
}
