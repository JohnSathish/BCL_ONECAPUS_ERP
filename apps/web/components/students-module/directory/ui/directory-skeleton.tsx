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
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <DirectorySkeleton key={i} className="h-[92px] rounded-xl border border-border/40" />
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
      <div className="flex items-center gap-3 px-2 py-2">
        <DirectorySkeleton className="h-3 w-3" />
        <DirectorySkeleton className="h-8 w-8 rounded-full" />
        <DirectorySkeleton className="h-8 w-36" />
        <DirectorySkeleton className="h-4 w-16" />
        <DirectorySkeleton className="h-4 w-20" />
        <DirectorySkeleton className="hidden h-4 w-28 sm:block" />
        <DirectorySkeleton className="ml-auto h-6 w-16" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border-t border-border/30 px-2 py-2">
          <DirectorySkeleton className="h-3 w-3" />
          <DirectorySkeleton className="h-8 w-8 rounded-full" />
          <div className="space-y-1">
            <DirectorySkeleton className="h-3 w-32" />
            <DirectorySkeleton className="h-2.5 w-40" />
          </div>
          <DirectorySkeleton className="h-3 w-16" />
          <DirectorySkeleton className="hidden h-3 w-24 md:block" />
          <DirectorySkeleton className="ml-auto h-5 w-14 rounded-full" />
        </div>
      ))}
    </div>
  );
}
