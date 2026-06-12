'use client';

import * as React from 'react';
import { CheckCircle2, Download, FileSpreadsheet, Loader2, RotateCcw, X } from 'lucide-react';

import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/utils/cn';

type BulkActionButtonProps = ButtonProps & {
  loading?: boolean;
  loadingText?: string;
  icon?: React.ReactNode;
  elevated?: boolean;
};

export function BulkActionButton({
  loading,
  loadingText,
  icon,
  elevated,
  children,
  className,
  disabled,
  ...props
}: BulkActionButtonProps) {
  return (
    <Button
      {...props}
      disabled={disabled || loading}
      className={cn(
        'gap-2 rounded-xl font-semibold shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 focus-visible:ring-2 focus-visible:ring-primary/40',
        elevated && 'shadow-[0_12px_28px_-18px_hsl(var(--primary))]',
        disabled && 'hover:translate-y-0 hover:shadow-sm',
        className,
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {loading ? (loadingText ?? children) : children}
    </Button>
  );
}

type TemplateDownloadActionProps = {
  disabled?: boolean;
  loading?: boolean;
  ready?: boolean;
  onClick: () => void;
  helperText?: string;
};

export function TemplateDownloadAction({
  disabled,
  loading,
  ready,
  onClick,
  helperText = 'Generate prefilled Excel template from selected filters.',
}: TemplateDownloadActionProps) {
  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <BulkActionButton
        type="button"
        size="lg"
        elevated
        disabled={disabled}
        loading={loading}
        loadingText="Generating Template..."
        icon={ready ? <CheckCircle2 className="h-5 w-5" /> : <Download className="h-5 w-5" />}
        onClick={onClick}
        className={cn(
          'h-11 bg-primary px-5 text-sm text-primary-foreground hover:bg-primary/95',
          ready && 'bg-emerald-600 hover:bg-emerald-600',
        )}
      >
        {ready ? 'Template Ready' : 'Download Generated Template'}
      </BulkActionButton>
      <span className="max-w-[320px] text-[11px] text-muted-foreground">{helperText}</span>
    </div>
  );
}

type SpreadsheetDropzoneProps = {
  file?: File | null;
  disabled?: boolean;
  loading?: boolean;
  accept?: string;
  title?: string;
  subtitle?: string;
  supportedText?: string;
  onFile: (file: File) => void;
  onRemove?: () => void;
};

export function SpreadsheetDropzone({
  file,
  disabled,
  loading,
  accept = '.xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  title = 'Drag & Drop Excel / CSV File',
  subtitle = 'or click to browse files',
  supportedText = 'XLSX • XLS • CSV',
  onFile,
  onRemove,
}: SpreadsheetDropzoneProps) {
  const [dragActive, setDragActive] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const fileSize = file ? `${Math.max(1, Math.round(file.size / 1024)).toLocaleString()} KB` : '';

  const pickFile = (nextFile?: File | null) => {
    if (!nextFile || disabled || loading) return;
    onFile(nextFile);
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      className={cn(
        'group rounded-2xl border border-dashed p-6 text-center transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        'border-border bg-background/70 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/5 hover:shadow-md',
        dragActive && 'border-primary bg-primary/10 shadow-[0_0_0_4px_hsl(var(--primary)/0.08)]',
        file && 'border-emerald-500/40 bg-emerald-500/5',
        (disabled || loading) &&
          'cursor-not-allowed opacity-70 hover:translate-y-0 hover:shadow-none',
      )}
      onClick={() => {
        if (!disabled && !loading) inputRef.current?.click();
      }}
      onKeyDown={(event) => {
        if ((event.key === 'Enter' || event.key === ' ') && !disabled && !loading) {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled && !loading) setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragActive(false);
        pickFile(event.dataTransfer.files?.[0]);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled || loading}
        onChange={(event) => {
          pickFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />

      {file ? (
        <div className="mx-auto max-w-md space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              {file.name}
            </p>
            <p className="text-xs text-muted-foreground">{fileSize}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <BulkActionButton
              type="button"
              size="sm"
              variant="outline"
              onClick={() => inputRef.current?.click()}
            >
              Replace File
            </BulkActionButton>
            {onRemove ? (
              <BulkActionButton
                type="button"
                size="sm"
                variant="ghost"
                icon={<X className="h-3.5 w-3.5" />}
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove();
                }}
              >
                Remove
              </BulkActionButton>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-md space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition group-hover:scale-105">
            {loading ? (
              <Loader2 className="h-7 w-7 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-7 w-7" />
            )}
          </div>
          <div>
            <p className="text-base font-semibold">{loading ? 'Processing file...' : title}</p>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <p className="rounded-full bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">
            Supported: {supportedText}
          </p>
        </div>
      )}
    </div>
  );
}

export type BulkWorkflowStep = {
  key: string;
  label: string;
};

export function BulkWorkflowStepper({
  steps,
  current,
}: {
  steps: BulkWorkflowStep[];
  current: number;
}) {
  const progress = steps.length <= 1 ? 100 : (current / (steps.length - 1)) * 100;
  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
        {steps.map((step, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <div
              key={step.key}
              className={cn(
                'rounded-xl border px-3 py-2 text-[11px] font-semibold transition-all duration-200',
                done &&
                  'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                active &&
                  'border-primary/40 bg-primary/10 text-primary shadow-md shadow-primary/10',
                !done && !active && 'border-border bg-background/60 text-muted-foreground',
              )}
            >
              <span className="mr-1">{done ? '✓' : active ? '●' : '○'}</span>
              {step.label}
            </div>
          );
        })}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export function BulkActionToolbar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-border/60 bg-card/80 p-2 shadow-sm backdrop-blur">
      {children}
    </div>
  );
}

export function BulkEmptyState({
  title,
  description,
  steps,
}: {
  title: string;
  description: string;
  steps: string[];
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-5">
      <div className="flex gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <FileSpreadsheet className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          <ol className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
            {steps.map((step, index) => (
              <li key={step}>
                <span className="mr-1 font-semibold text-primary">{index + 1}.</span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

export function ResetAction({ onClick }: { onClick: () => void }) {
  return (
    <BulkActionButton
      type="button"
      variant="ghost"
      size="sm"
      icon={<RotateCcw className="h-4 w-4" />}
      onClick={onClick}
    >
      Reset
    </BulkActionButton>
  );
}
