'use client';

import { Building2, Sun, Sunrise } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useInstitutionBranding } from '@/hooks/use-institution-branding';
import { useWorkspaceContext } from '@/providers/workspace-provider';
import {
  WORKSPACE_ACCENTS,
  WORKSPACE_DEFINITIONS,
  type WorkspaceKind,
} from '@/lib/workspace/workspace-types';
import { listSelectableWorkspaces } from '@/lib/workspace/workspace-utils';
import { cn } from '@/utils/cn';

const ICONS: Record<WorkspaceKind, typeof Building2> = {
  institution: Building2,
  morning: Sunrise,
  day: Sun,
};

export function WorkspacePicker() {
  const router = useRouter();
  const branding = useInstitutionBranding();
  const { user, setWorkspaceKind } = useWorkspaceContext();
  const options = listSelectableWorkspaces(user);
  const institutionLabel =
    branding.branding?.displayName ?? branding.branding?.productName ?? 'Campus ERP';

  const enter = (kind: WorkspaceKind) => {
    setWorkspaceKind(kind);
    router.replace('/admin');
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 px-4 py-10">
      <div className="w-full max-w-3xl space-y-8">
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {institutionLabel}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Choose your workspace
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Morning and Day operate as independent admin workspaces. Your choice is remembered for
            next login.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {options.map((option) => {
            const Icon = ICONS[option.kind];
            const accent = WORKSPACE_ACCENTS[option.kind];
            const def = WORKSPACE_DEFINITIONS[option.kind];
            return (
              <button
                key={option.kind}
                type="button"
                onClick={() => enter(option.kind)}
                className={cn(
                  'group flex flex-col rounded-2xl border bg-card p-5 text-left shadow-sm transition',
                  'hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                )}
                style={{ borderTopWidth: 3, borderTopColor: accent.cssVar }}
              >
                <span
                  className={cn(
                    'mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl border',
                    accent.badgeClass,
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-base font-semibold">{def.title}</span>
                <span className="mt-1 text-sm text-muted-foreground">{def.subtitle}</span>
                <span className="mt-4 text-xs font-medium text-primary opacity-0 transition group-hover:opacity-100">
                  Enter workspace →
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
