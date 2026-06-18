'use client';

import { PrincipalDeskNav } from '@/components/principal-desk/principal-desk-nav';
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
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-background">
      <PrincipalDeskNav />
      <main className={cn('mx-auto max-w-6xl px-4 py-6', className)}>
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-900 dark:text-foreground">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
        {children}
      </main>
    </div>
  );
}
