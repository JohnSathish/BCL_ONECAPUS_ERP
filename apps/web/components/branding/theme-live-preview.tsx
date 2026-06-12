'use client';

import { useEffect, useRef, useState } from 'react';
import type { AppThemeSettings } from '@/types/branding';
import { applyCssVariablesToRoot, themeToCssVariables } from '@/lib/theme/css-variables';
import { mergedTheme, useThemeStore } from '@/lib/theme/theme-store';
import { cn } from '@/utils/cn';

type Props = {
  theme: AppThemeSettings | null;
  displayName?: string;
  className?: string;
};

export function ThemeLivePreview({ theme, displayName = 'Campus ERP', className }: Props) {
  const draft = useThemeStore((s) => s.draft);
  const storeTheme = useThemeStore((s) => s.theme);
  const previewRef = useRef<HTMLDivElement>(null);
  const [previewDark, setPreviewDark] = useState(false);

  const base = storeTheme ?? theme;
  const effective = base ? mergedTheme(base, draft) : null;

  useEffect(() => {
    const el = previewRef.current;
    if (!el || !effective) return;
    applyCssVariablesToRoot(themeToCssVariables(effective, previewDark), el);
  }, [effective, previewDark]);

  if (!effective) {
    return (
      <div
        className={cn(
          'rounded-xl border border-border/60 bg-muted/30 p-6 text-sm text-muted-foreground',
          className,
        )}
      >
        Loading preview…
      </div>
    );
  }

  return (
    <div
      className={cn('overflow-hidden rounded-xl border border-border/60 shadow-soft', className)}
    >
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">Live preview</span>
        <div className="flex gap-1 rounded-lg border border-border/60 p-0.5">
          <button
            type="button"
            className={cn(
              'rounded-md px-2 py-0.5 text-[10px] font-medium',
              !previewDark && 'bg-background shadow-sm',
            )}
            onClick={() => setPreviewDark(false)}
          >
            Light
          </button>
          <button
            type="button"
            className={cn(
              'rounded-md px-2 py-0.5 text-[10px] font-medium',
              previewDark && 'bg-background shadow-sm',
            )}
            onClick={() => setPreviewDark(true)}
          >
            Dark
          </button>
        </div>
      </div>

      <div ref={previewRef} className="bg-background text-foreground">
        <div className="flex min-h-[320px]">
          <aside className="flex w-20 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-2">
            <div className="mb-3 h-7 rounded-md bg-sidebar-active/70" />
            <div className="space-y-1">
              <div className="rounded-md bg-sidebar-active px-2 py-1.5 text-[9px] text-sidebar-foreground">
                Dashboard
              </div>
              <div className="rounded-md px-2 py-1.5 text-[9px] text-sidebar-muted">Students</div>
              <div className="rounded-md px-2 py-1.5 text-[9px] text-sidebar-muted">Reports</div>
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            <header className="flex h-10 items-center border-b border-border bg-topbar/95 px-3">
              <span className="truncate text-[11px] font-semibold text-header-foreground">
                {displayName}
              </span>
            </header>

            <div className="space-y-3 p-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-border bg-card p-2">
                  <div className="text-[8px] uppercase text-muted-foreground">Attendance</div>
                  <div className="mt-1 text-sm font-semibold">94%</div>
                </div>
                <div className="rounded-lg border border-border bg-card p-2">
                  <div className="text-[8px] uppercase text-muted-foreground">Fees</div>
                  <div className="mt-1 text-sm font-semibold text-success">82%</div>
                </div>
                <div className="rounded-lg border border-border bg-card p-2">
                  <div className="text-[8px] uppercase text-muted-foreground">Alerts</div>
                  <div className="mt-1 text-sm font-semibold text-warning">12</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <span className="btn-theme-primary rounded-md px-2.5 py-1 text-[9px] font-medium">
                  Primary
                </span>
                <span className="btn-theme-secondary rounded-md px-2.5 py-1 text-[9px] font-medium">
                  Secondary
                </span>
                <span className="rounded-md border border-border bg-card px-2.5 py-1 text-[9px] font-medium">
                  Outline
                </span>
                <span className="btn-theme-destructive rounded-md px-2.5 py-1 text-[9px] font-medium">
                  Delete
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div
                  className="glass-card rounded-lg p-2"
                  style={{ padding: 'var(--card-padding)' }}
                >
                  <div className="mb-1 text-[9px] font-semibold">Glass card</div>
                  <div className="h-2 w-2/3 rounded bg-muted" />
                </div>
                <div
                  className="rounded-lg border border-border bg-card p-2"
                  style={{ padding: 'var(--card-padding)', boxShadow: 'var(--card-shadow)' }}
                >
                  <div className="mb-1 text-[9px] font-semibold">Elevated card</div>
                  <div className="h-2 w-1/2 rounded bg-muted" />
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-border">
                <div className="theme-table-header grid grid-cols-3 gap-2 border-b border-border px-2 py-1.5 text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>Name</span>
                  <span>Status</span>
                  <span>Date</span>
                </div>
                <div className="theme-table-row grid grid-cols-3 gap-2 px-2 text-[9px]">
                  <span>John Doe</span>
                  <span className="text-success">Active</span>
                  <span>Today</span>
                </div>
                <div className="theme-table-row grid grid-cols-3 gap-2 px-2 text-[9px]">
                  <span>Jane Smith</span>
                  <span className="text-warning">Pending</span>
                  <span>Yesterday</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="border-t border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        Draft changes apply instantly across the portal shell
      </p>
    </div>
  );
}
