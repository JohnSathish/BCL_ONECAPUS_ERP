'use client';

import { cn } from '@/utils/cn';

type Props = {
  children: React.ReactNode;
  className?: string;
};

export function DirectoryShell({ children, className }: Props) {
  return (
    <div className={cn('relative min-w-0', className)}>
      <div
        className="pointer-events-none absolute inset-0 -z-10 hero-mesh opacity-90"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.03] dark:opacity-[0.06]"
        style={{
          backgroundImage:
            'linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
        aria-hidden
      />
      {children}
    </div>
  );
}
