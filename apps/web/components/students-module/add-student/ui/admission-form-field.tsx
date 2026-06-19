'use client';

import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { cloneElement, isValidElement, useId, useRef, useEffect } from 'react';

import { cn } from '@/utils/cn';

type Props = {
  label: string;
  fieldKey?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  optional?: boolean;
  success?: boolean;
  labelAction?: React.ReactNode;
  className?: string;
  children: React.ReactElement<{ id?: string; className?: string; 'aria-invalid'?: boolean }>;
};

export const admissionInputClass =
  'h-12 w-full rounded-xl border bg-background px-3.5 text-sm shadow-sm outline-none transition-all duration-200 placeholder:text-muted-foreground/60 hover:border-primary/40 focus:border-primary focus:ring-[3px] focus:ring-primary/15 dark:bg-background/80';

export const admissionSelectClass =
  'h-12 w-full rounded-xl border bg-background px-3.5 text-sm shadow-sm outline-none transition-all duration-200 hover:border-primary/40 focus:border-primary focus:ring-[3px] focus:ring-primary/15 dark:bg-background/80';

export function AdmissionFormField({
  label,
  fieldKey,
  error,
  hint,
  required,
  optional,
  success,
  labelAction,
  className,
  children,
}: Props) {
  const autoId = useId();
  const inputId = fieldKey ? `admission-${fieldKey}` : autoId;
  const shakeRef = useRef<HTMLDivElement>(null);
  const showSuccess = success && !error;

  useEffect(() => {
    if (!error || !shakeRef.current) return;
    shakeRef.current.classList.remove('admission-field-shake');
    void shakeRef.current.offsetWidth;
    shakeRef.current.classList.add('admission-field-shake');
  }, [error]);

  const child = isValidElement(children)
    ? cloneElement(children, {
        id: inputId,
        'aria-invalid': Boolean(error),
        className: cn(
          children.props.className,
          error
            ? 'border-destructive/70 pr-10 focus:border-destructive focus:ring-destructive/15'
            : showSuccess
              ? 'border-emerald-500/70 pr-10 focus:border-emerald-500 focus:ring-emerald-500/15'
              : 'border-border/70',
        ),
      })
    : children;

  return (
    <div
      ref={shakeRef}
      data-admission-field={fieldKey}
      className={cn('flex min-w-0 flex-col gap-1.5', className)}
    >
      <div className="flex min-h-[22px] items-center justify-between gap-2">
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          {label}
          {required ? <span className="ml-0.5 text-destructive">*</span> : null}
        </label>
        {labelAction ? (
          <div className="shrink-0">{labelAction}</div>
        ) : optional ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            Optional
          </span>
        ) : null}
      </div>

      <div className="relative">
        {child}
        {error ? (
          <AlertCircle className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-destructive" />
        ) : showSuccess ? (
          <CheckCircle2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" />
        ) : null}
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-destructive">
            Required
          </p>
          <p className="mt-0.5 text-sm leading-snug text-destructive">{error}</p>
        </div>
      ) : hint ? (
        <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function scrollToAdmissionField(fieldKey: string) {
  const el = document.querySelector(`[data-admission-field="${fieldKey}"]`);
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
