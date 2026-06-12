'use client';

import type { BulkUpdatePreviewResult } from '@/services/student-bulk-update';
import { formatFieldValue } from '@/services/student-bulk-update';
import { cn } from '@/utils/cn';

type Props = {
  preview: BulkUpdatePreviewResult | null;
  loading?: boolean;
  error?: string;
  forceApply: boolean;
  onForceApplyChange: (v: boolean) => void;
  onRunPreview?: () => void;
};

export function BulkUpdatePreviewStep({
  preview,
  loading,
  error,
  forceApply,
  onForceApplyChange,
  onRunPreview,
}: Props) {
  if (loading) {
    return (
      <div className="rounded-3xl border border-primary/20 bg-primary/5 p-4 text-sm text-primary">
        Generating preview and validating change safety...
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <p className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
        {onRunPreview ? (
          <button
            type="button"
            className="rounded-2xl border border-border px-3 py-1.5 text-xs transition hover:-translate-y-0.5 hover:bg-muted hover:shadow-sm"
            onClick={onRunPreview}
          >
            Retry preview
          </button>
        ) : null}
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="space-y-3">
        <div className="rounded-3xl border border-dashed border-border bg-muted/20 p-5">
          <h2 className="text-sm font-semibold">Preview Before Commit</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Run preview to see impacted students, field changes, warnings, conflicts, and OLD to NEW
            diffs.
          </p>
        </div>
        {onRunPreview ? (
          <button
            type="button"
            className="rounded-2xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:-translate-y-0.5 hover:shadow-md"
            onClick={onRunPreview}
          >
            Generate preview
          </button>
        ) : null}
      </div>
    );
  }

  const canApply = preview.invalid === 0 || forceApply;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Change Summary</h2>
        <p className="text-xs text-muted-foreground">
          Review affected rows, warnings, conflicts, and audit-ready diffs before execution.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Students affected" value={preview.total} />
        <Stat label="Ready" value={preview.valid} tone="ok" />
        <Stat label="Warnings" value={0} tone="warn" />
        <Stat
          label="Conflicts"
          value={preview.invalid}
          tone={preview.invalid ? 'bad' : undefined}
        />
      </div>

      {preview.invalid > 0 ? (
        <label className="flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
          <input
            type="checkbox"
            checked={forceApply}
            onChange={(e) => onForceApplyChange(e.target.checked)}
          />
          Apply anyway ({preview.invalid} students have validation errors)
        </label>
      ) : null}

      {preview.rowsTruncated ? (
        <p className="text-xs text-muted-foreground">
          Showing first {preview.rows.length} of {preview.total} students.
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-2 py-2">Student</th>
              <th className="px-2 py-2">Changes</th>
              <th className="px-2 py-2">Errors</th>
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row) => (
              <tr key={row.studentId} className="border-t border-border/60 align-top">
                <td className="px-2 py-2">
                  <div className="font-medium">{row.fullName}</div>
                  <div className="text-muted-foreground">
                    {row.rollNumber ?? '—'} · {row.enrollmentNumber}
                  </div>
                </td>
                <td className="px-2 py-2">
                  {row.changes.length === 0 ? (
                    <span className="text-muted-foreground">No changes</span>
                  ) : (
                    <ul className="space-y-1">
                      {row.changes.map((c) => (
                        <li key={c.fieldKey}>
                          <span className="font-medium">{c.label}:</span>{' '}
                          <span className="text-muted-foreground line-through">
                            {formatFieldValue(c.before)}
                          </span>{' '}
                          → <span>{formatFieldValue(c.after)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="px-2 py-2">
                  {row.errors.length ? (
                    <ul className="space-y-0.5 text-destructive">
                      {row.errors.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-emerald-600">OK</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!canApply ? (
        <p className="text-xs text-destructive">
          Fix validation errors or enable override to apply.
        </p>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'ok' | 'bad' | 'warn';
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border bg-background/70 px-3 py-2',
        tone === 'ok' && 'border-emerald-500/30 bg-emerald-500/5',
        tone === 'warn' && 'border-amber-500/30 bg-amber-500/5',
        tone === 'bad' && 'border-destructive/30 bg-destructive/5',
      )}
    >
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

export function canApplyPreview(
  preview: BulkUpdatePreviewResult | null,
  forceApply: boolean,
): boolean {
  if (!preview) return false;
  return preview.invalid === 0 || forceApply;
}
