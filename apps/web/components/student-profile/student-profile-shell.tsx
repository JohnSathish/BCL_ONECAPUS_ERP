'use client';

import { cn } from '@/utils/cn';
import { PROFILE_SECTIONS, type ProfileSectionKey } from '@/types/student-profile';

type Props = {
  active: ProfileSectionKey;
  onChange: (key: ProfileSectionKey) => void;
  completionPercent?: number;
  sectionStatus?: Record<string, { complete: boolean }>;
};

export function StudentProfileShell({
  active,
  onChange,
  completionPercent = 0,
  sectionStatus,
  children,
}: Props & { children: React.ReactNode }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <aside className="space-y-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Profile completion
          </p>
          <p className="mt-1 text-2xl font-semibold">{completionPercent}%</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {PROFILE_SECTIONS.map((s) => {
            const complete = sectionStatus?.[s.key]?.complete;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => onChange(s.key)}
                className={cn(
                  'rounded-md px-3 py-2 text-left text-sm transition-colors',
                  active === s.key
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  {s.label}
                  {complete !== undefined ? (
                    <span
                      className={cn(
                        'h-2 w-2 shrink-0 rounded-full',
                        complete ? 'bg-emerald-500' : 'bg-amber-400',
                      )}
                    />
                  ) : null}
                </span>
              </button>
            );
          })}
        </nav>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function SectionCard({
  title,
  description,
  children,
  footer,
  footerClassName,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  footerClassName?: string;
}) {
  return (
    <div className="glass-card overflow-hidden rounded-xl border border-border/50 bg-card/80">
      <div className="border-b border-border/50 px-3 py-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="space-y-2.5 p-3">{children}</div>
      {footer ? (
        <div
          className={cn(
            'border-t border-border/50 px-3 py-2 text-[11px] text-muted-foreground',
            footerClassName,
          )}
        >
          {footer}
        </div>
      ) : null}
    </div>
  );
}

export function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  'h-8 w-full rounded-lg border border-border/60 bg-background px-2.5 text-xs';
