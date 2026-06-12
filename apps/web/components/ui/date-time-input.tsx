'use client';

import * as React from 'react';
import { cn } from '@/utils/cn';
import { isoToDisplayDateTimeInput, parseDisplayDateTimeToIso } from '@/utils/format-date';

export type DateTimeInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange'
> & {
  /** ISO timestamp string */
  value?: string;
  /** Emits ISO timestamp string, or empty string when cleared */
  onChange?: (isoDateTime: string) => void;
};

export const DateTimeInput = React.forwardRef<HTMLInputElement, DateTimeInputProps>(
  (
    { className, value = '', onChange, onBlur, placeholder = 'dd/mm/yyyy hh:mm', ...props },
    ref,
  ) => {
    const [text, setText] = React.useState(() => isoToDisplayDateTimeInput(value));

    React.useEffect(() => {
      setText(isoToDisplayDateTimeInput(value));
    }, [value]);

    return (
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        className={cn(
          'flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
        value={text}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          if (!next.trim()) {
            onChange?.('');
            return;
          }
          const iso = parseDisplayDateTimeToIso(next);
          if (iso) onChange?.(iso);
        }}
        onBlur={(event) => {
          const iso = parseDisplayDateTimeToIso(text);
          if (iso) {
            onChange?.(iso);
            setText(isoToDisplayDateTimeInput(iso));
          } else if (text.trim()) {
            setText(isoToDisplayDateTimeInput(value));
          } else {
            onChange?.('');
            setText('');
          }
          onBlur?.(event);
        }}
        {...props}
      />
    );
  },
);

DateTimeInput.displayName = 'DateTimeInput';
