'use client';

import { cn } from '@/utils/cn';

export function PrincipalDeskShell({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mx-auto max-w-6xl px-4 py-6', className)}>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-foreground">{title}</h1>
        {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}
