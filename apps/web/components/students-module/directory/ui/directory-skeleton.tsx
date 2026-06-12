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
    <div className="flex gap-2 overflow-hidden">
      {Array.from({ length: 9 }).map((_, i) => (
        <DirectorySkeleton key={i} className="h-16 min-w-[108px] flex-1 rounded-[20px]" />
      ))}
    </div>
  );
}

export function DirectoryTableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="glass-card space-y-1 rounded-xl p-2">
      <DirectorySkeleton className="h-7 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <DirectorySkeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}
