import { cn } from '@/utils/cn';

export function DirectorySkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-gradient-to-r from-muted/60 via-muted/40 to-muted/60 bg-[length:200%_100%] motion-reduce:animate-none',
        className,
      )}
    />
  );
}

export function DirectoryKpiSkeleton() {
  return (
    <div className="flex gap-0 overflow-hidden rounded-xl border border-border/50">
      {Array.from({ length: 7 }).map((_, i) => (
        <DirectorySkeleton key={i} className="h-14 min-w-[120px] flex-1" />
      ))}
    </div>
  );
}

export function DirectoryTableSkeleton({
  rows = 10,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div
      className={cn('glass-card flex min-h-0 flex-1 flex-col space-y-1 rounded-xl p-2', className)}
    >
      <DirectorySkeleton className="h-7 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <DirectorySkeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}
