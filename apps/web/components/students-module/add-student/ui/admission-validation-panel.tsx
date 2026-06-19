'use client';

import { AlertTriangle } from 'lucide-react';

import { admissionFieldLabel } from '@/components/students-module/add-student/constants/field-labels';
import { scrollToAdmissionField } from '@/components/students-module/add-student/ui/admission-form-field';
import { cn } from '@/utils/cn';

type Props = {
  errors: Record<string, string>;
  title?: string;
  className?: string;
  nehuWarnings?: string[];
};

export function AdmissionValidationPanel({
  errors,
  title = 'Admission Form Validation',
  className,
  nehuWarnings = [],
}: Props) {
  const entries = Object.entries(errors).filter(([, msg]) => Boolean(msg));
  if (entries.length === 0 && nehuWarnings.length === 0) return null;

  return (
    <div
      className={cn(
        'mb-4 rounded-xl border border-destructive/30 bg-destructive/[0.04] p-3 shadow-sm',
        className,
      )}
      role="alert"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {entries.length > 0 ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {entries.length} field{entries.length === 1 ? '' : 's'} require
              {entries.length === 1 ? 's' : ''} correction
            </p>
          ) : null}
          {entries.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {entries.map(([key, message]) => (
                <li key={key}>
                  <button
                    type="button"
                    className="text-left text-xs text-destructive underline-offset-2 hover:underline"
                    onClick={() => scrollToAdmissionField(key)}
                  >
                    {admissionFieldLabel(key)} — {message.split('.')[0]}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {nehuWarnings.map((warning) => (
            <p
              key={warning}
              className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-900 dark:text-amber-100"
            >
              {warning}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AdmissionIncompleteBanner({
  errors,
  className,
}: {
  errors: Record<string, string>;
  className?: string;
}) {
  const entries = Object.entries(errors).filter(([, msg]) => Boolean(msg));
  if (entries.length === 0) return null;

  return (
    <div
      className={cn(
        'mb-3 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 text-sm',
        className,
      )}
      role="status"
    >
      <p className="font-semibold text-amber-950 dark:text-amber-50">Admission form incomplete</p>
      <p className="mt-1 text-xs text-amber-900/90 dark:text-amber-100/90">
        Please complete {entries.length} required field{entries.length === 1 ? '' : 's'} before
        continuing.
      </p>
      <ul className="mt-2 list-inside list-disc text-xs text-amber-900 dark:text-amber-100">
        {entries.slice(0, 5).map(([key]) => (
          <li key={key}>{admissionFieldLabel(key)}</li>
        ))}
        {entries.length > 5 ? <li>…and {entries.length - 5} more</li> : null}
      </ul>
    </div>
  );
}
