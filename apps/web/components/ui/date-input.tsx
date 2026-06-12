'use client';

import * as React from 'react';
import { CalendarDays } from 'lucide-react';
import { cn } from '@/utils/cn';
import { isoToDisplayDate, parseDisplayDateToIso, parseIsoDate } from '@/utils/format-date';

export type DateInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange'
> & {
  /** ISO date string yyyy-mm-dd */
  value?: string;
  /** Emits ISO date string yyyy-mm-dd, or empty string when cleared */
  onChange?: (isoDate: string) => void;
};

function toNativeDateValue(value?: string): string {
  if (!value?.trim()) return '';
  const iso = parseDisplayDateToIso(value);
  return iso ?? '';
}

export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  (
    {
      className,
      value = '',
      onChange,
      onBlur,
      onClick,
      onFocus,
      placeholder = 'dd/mm/yyyy',
      min,
      max,
      disabled,
      ...props
    },
    ref,
  ) => {
    const [text, setText] = React.useState(() => isoToDisplayDate(value));
    const nativePickerRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
      setText(isoToDisplayDate(value));
    }, [value]);

    const openPicker = React.useCallback(() => {
      if (disabled) return;
      const picker = nativePickerRef.current;
      if (!picker) return;
      if (typeof picker.showPicker === 'function') {
        try {
          picker.showPicker();
          return;
        } catch {
          // Some browsers throw if not triggered from a direct user gesture.
        }
      }
      picker.focus();
      picker.click();
    }, [disabled]);

    return (
      <div className="relative w-full">
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'flex h-10 w-full rounded-md border border-border bg-card py-2 pl-3 pr-9 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
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
            const iso = parseDisplayDateToIso(next);
            if (iso) onChange?.(iso);
          }}
          onBlur={(event) => {
            const iso = parseDisplayDateToIso(text);
            if (iso) {
              onChange?.(iso);
              setText(isoToDisplayDate(iso));
            } else if (text.trim()) {
              setText(isoToDisplayDate(value));
            } else {
              onChange?.('');
              setText('');
            }
            onBlur?.(event);
          }}
          onFocus={(event) => {
            if (!text.trim()) openPicker();
            onFocus?.(event);
          }}
          onClick={onClick}
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-label="Open calendar"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            openPicker();
          }}
        >
          <CalendarDays className="h-4 w-4" aria-hidden />
        </button>
        <input
          ref={nativePickerRef}
          type="date"
          tabIndex={-1}
          aria-hidden
          disabled={disabled}
          className="pointer-events-none absolute bottom-0 right-0 h-px w-px opacity-0"
          value={toNativeDateValue(value)}
          min={typeof min === 'string' ? toNativeDateValue(min) || min : undefined}
          max={typeof max === 'string' ? toNativeDateValue(max) || max : undefined}
          onChange={(event) => {
            const iso = event.target.value;
            if (!iso) {
              onChange?.('');
              setText('');
              return;
            }
            if (!parseIsoDate(iso)) return;
            onChange?.(iso);
            setText(isoToDisplayDate(iso));
          }}
        />
      </div>
    );
  },
);

DateInput.displayName = 'DateInput';
