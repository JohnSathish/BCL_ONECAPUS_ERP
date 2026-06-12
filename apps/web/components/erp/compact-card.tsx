import { cn } from '@/utils/cn';

export function CompactCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'min-w-0 max-w-full rounded-lg border border-border bg-card text-card-foreground shadow-sm',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CompactCardHeader({
  className,
  title,
  description,
}: {
  className?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className={cn('border-b border-border/60 px-4 py-3', className)}>
      <h3 className="text-sm font-semibold leading-tight">{title}</h3>
      {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
    </div>
  );
}

export function CompactCardBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn('p-4', className)}>{children}</div>;
}
