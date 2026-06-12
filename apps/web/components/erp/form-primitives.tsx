import { cn } from '@/utils/cn';
import { Label } from '@/components/ui/label';

export const erpSelectClass =
  'h-9 w-full max-w-full rounded-md border border-border bg-card px-2.5 text-sm';

export const erpInputCompact = 'h-9 text-sm';

export function ERPField({
  className,
  label,
  htmlFor,
  helper,
  error,
  optional,
  labelAction,
  children,
}: {
  className?: string;
  label: string;
  htmlFor?: string;
  helper?: string;
  error?: string;
  optional?: boolean;
  labelAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  const helperText = error ?? helper;

  return (
    <div className={cn('flex min-w-0 flex-col justify-start', className)}>
      <div className="flex min-h-[22px] items-center justify-between gap-2">
        <Label htmlFor={htmlFor} className="text-xs font-semibold text-foreground">
          {label}
        </Label>
        {labelAction ? (
          <div className="shrink-0">{labelAction}</div>
        ) : optional ? (
          <span className="shrink-0 text-[10px] font-normal text-muted-foreground">Optional</span>
        ) : null}
      </div>
      <div className="flex min-h-[44px] min-w-0 items-start">{children}</div>
      <p
        className={cn(
          'min-h-[18px] text-[10px] leading-[18px]',
          error ? 'font-medium text-destructive' : 'text-muted-foreground',
          !helperText && 'invisible',
        )}
      >
        {helperText || 'placeholder'}
      </p>
    </div>
  );
}

export function FormGrid({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2', className)}>
      {children}
    </div>
  );
}

export function FormField({
  className,
  label,
  htmlFor,
  children,
  span = 1,
}: {
  className?: string;
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
  span?: 1 | 2;
}) {
  return (
    <div className={cn('space-y-1.5', span === 2 && 'sm:col-span-2', className)}>
      <Label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
