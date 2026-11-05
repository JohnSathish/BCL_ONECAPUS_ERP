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
  action,
  id,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  footerClassName?: string;
  action?: React.ReactNode;
  id?: string;
}) {
  return (
    <div
      id={id}
      className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm dark:border-border dark:bg-card"
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5 dark:border-border/60">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900 sm:text-[15px] dark:text-foreground">
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-xs text-slate-500 dark:text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="space-y-3 p-4 sm:p-5">{children}</div>
      {footer ? (
        <div
          className={cn(
            'border-t border-border/50 px-4 py-2.5 text-xs text-muted-foreground sm:px-5',
            footerClassName,
          )}
        >
          {footer}
        </div>
      ) : null}
    </div>
  );
}

export function FieldGrid({
  children,
  columns = 'wide',
}: {
  children: React.ReactNode;
  columns?: 'pair' | 'wide';
}) {
  return (
    <div
      className={cn(
        'grid gap-3',
        columns === 'pair' ? 'sm:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-3',
      )}
    >
      {children}
    </div>
  );
}

export function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="text-xs font-medium text-slate-600 dark:text-muted-foreground">
        {label}
        {required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </span>
      {children}
    </label>
  );
}

export const inputClass =
  'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-default disabled:bg-slate-50 disabled:text-slate-700 dark:border-border dark:bg-background dark:text-foreground dark:disabled:bg-muted/40';
