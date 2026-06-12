'use client';

import { cn } from '@/utils/cn';

type Props = {
  children: React.ReactNode;
  className?: string;
};

export function AnalyticsPageShell({ children, className }: Props) {
  return (
    <div
      className={cn(
        'mx-auto grid w-full min-w-0 max-w-[1600px] grid-cols-12 gap-4 pb-20 md:gap-5 md:pb-8 lg:gap-6',
        className,
      )}
    >
      {children}
    </div>
  );
}
