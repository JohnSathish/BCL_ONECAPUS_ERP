import * as React from 'react';
import { cn } from '@/utils/cn';

export function Progress({
  className,
  value = 0,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { value?: number }) {
  const pct = Math.min(Math.max(value, 0), 100);
  return (
    <div
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-muted', className)}
      {...props}
    >
      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}
