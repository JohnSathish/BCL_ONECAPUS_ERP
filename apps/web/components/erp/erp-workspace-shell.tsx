'use client';

import type { LucideIcon } from 'lucide-react';

import { cn } from '@/utils/cn';

/** Shared elevated card shell for ERP form sections */
export const erpFormSectionShellClass =
  'overflow-visible rounded-2xl border border-border/60 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)] dark:border-border/50 dark:bg-card/95 dark:shadow-[0_1px_2px_rgba(0,0,0,0.2),0_8px_24px_rgba(0,0,0,0.25)]';

/** Full-width ERP workspace — use inside DashboardShell main content */
export const erpWorkspaceClass = 'w-full max-w-[1800px] mx-auto px-3 md:px-4 lg:px-6';

export function ErpWorkspace({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn(erpWorkspaceClass, className)}>{children}</div>;
}

/** Main form + sticky summary sidebar (75/25 desktop) */
export function ErpWorkspaceGrid({
  main,
  sidebar,
  className,
}: {
  main: React.ReactNode;
  sidebar?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid items-start gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(320px,1fr)] xl:gap-4',
        className,
      )}
    >
      <div className="min-w-0 overflow-visible">{main}</div>
      {sidebar ? (
        <div className="hidden lg:block">
          <div className="sticky top-[72px] max-h-[calc(100vh-88px)] overflow-y-auto">
            {sidebar}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ErpFormSection({
  title,
  description,
  icon: Icon,
  children,
  className,
  collapsible,
  defaultOpen = true,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const header = (
    <div className="flex items-start gap-3">
      {Icon ? (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      ) : null}
      <div className="min-w-0 pt-0.5">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
        {description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </div>
  );

  const body = <div className="px-6 pb-6 pt-4 sm:px-7 sm:pb-7">{children}</div>;

  if (collapsible) {
    return (
      <details open={defaultOpen} className={cn(erpFormSectionShellClass, className)}>
        <summary className="cursor-pointer list-none border-b border-border/40 px-6 py-5 marker:content-none sm:px-7">
          {header}
        </summary>
        {body}
      </details>
    );
  }

  return (
    <section className={cn(erpFormSectionShellClass, className)}>
      <div className="border-b border-border/40 px-6 py-5 sm:px-7">{header}</div>
      {body}
    </section>
  );
}

/** Responsive ERP form grid with consistent vertical rhythm */
export function ErpFormGrid({
  children,
  cols = 2,
  className,
}: {
  children: React.ReactNode;
  cols?: 2 | 3;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 items-start gap-5 md:grid-cols-12',
        cols === 3 ? 'md:[&>*]:col-span-6 lg:[&>*]:col-span-4' : 'md:[&>*]:col-span-6',
        className,
      )}
    >
      {children}
    </div>
  );
}
