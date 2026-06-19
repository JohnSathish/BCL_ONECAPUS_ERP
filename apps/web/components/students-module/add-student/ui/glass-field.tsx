'use client';

import { ERPField } from '@/components/erp/form-primitives';
import { cn } from '@/utils/cn';

type Props = {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
  labelAction?: React.ReactNode;
};

export function GlassField({
  label,
  error,
  hint,
  optional,
  htmlFor,
  children,
  className,
  labelAction,
}: Props) {
  return (
    <ERPField
      className={className}
      label={label}
      htmlFor={htmlFor}
      helper={hint}
      error={error}
      optional={optional}
      labelAction={labelAction}
    >
      {children}
    </ERPField>
  );
}

export const glassInputClass =
  'h-12 w-full rounded-xl border border-border/70 bg-background px-3.5 text-sm shadow-sm outline-none transition-all duration-200 placeholder:text-muted-foreground/60 hover:border-primary/40 focus:border-primary focus:ring-[3px] focus:ring-primary/15 dark:bg-background/80';

export const glassSelectClass =
  'h-12 w-full rounded-xl border border-border/70 bg-background px-3.5 text-sm shadow-sm outline-none transition-all duration-200 hover:border-primary/40 focus:border-primary focus:ring-[3px] focus:ring-primary/15 dark:bg-background/80';

export const admissionFormGridClass =
  'grid grid-cols-1 items-start gap-5 md:grid-cols-12 md:[&>*]:col-span-6 lg:[&>*]:col-span-4';
