'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  applyDepartmentBackfillFromProgramme,
  previewDepartmentBackfillFromProgramme,
  type DepartmentBackfillResult,
} from '@/services/student-bulk-update';
import { apiErrorMessage } from '@/utils/api-error';

export function DepartmentBackfillCard() {
  const qc = useQueryClient();
  const previewQ = useQuery({
    queryKey: ['students', 'departments', 'backfill-from-programme', 'preview'],
    queryFn: previewDepartmentBackfillFromProgramme,
    staleTime: 30_000,
  });
  const applyMut = useMutation({
    mutationFn: applyDepartmentBackfillFromProgramme,
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ['students', 'departments', 'backfill-from-programme', 'preview'],
      });
      void qc.invalidateQueries({ queryKey: ['students'] });
    },
  });

  const preview = previewQ.data;
  const result = applyMut.data as DepartmentBackfillResult | undefined;

  return (
    <section className="rounded-3xl border border-border/60 bg-card/85 p-5 shadow-lg shadow-black/5 backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl space-y-1.5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Building2 className="h-4 w-4 text-primary" />
            Backfill departments from programme
          </div>
          <p className="text-sm text-muted-foreground">
            For students with no department, copy the academic department linked to their programme
            (e.g. FYUP in Geography → Geography). Existing departments are never overwritten.
          </p>
        </div>
        <Button
          type="button"
          className="rounded-xl"
          disabled={applyMut.isPending || previewQ.isLoading || !preview || preview.eligible === 0}
          onClick={() => {
            if (!preview?.eligible) return;
            const ok = window.confirm(
              `Set department for ${preview.eligible} student(s) from their programme? This cannot be undone automatically.`,
            );
            if (ok) applyMut.mutate();
          }}
        >
          {applyMut.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Applying…
            </>
          ) : (
            `Apply backfill${preview?.eligible ? ` (${preview.eligible})` : ''}`
          )}
        </Button>
      </div>

      {previewQ.isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading preview…</p>
      ) : previewQ.isError ? (
        <p className="mt-4 text-sm text-destructive">
          {apiErrorMessage(previewQ.error, 'Failed to load backfill preview')}
        </p>
      ) : preview ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Eligible to fill" value={preview.eligible} emphasis />
          <Stat label="Already has department" value={preview.alreadyHasDepartment} />
          <Stat label="No programme" value={preview.missingProgramme} />
          <Stat label="Programme has no dept" value={preview.programmeHasNoDepartment} />
          <Stat label="Non-academic dept link" value={preview.departmentNotAcademic} />
        </div>
      ) : null}

      {preview?.sample?.length ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-border/60">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Student</th>
                <th className="px-3 py-2 font-medium">Roll / Reg</th>
                <th className="px-3 py-2 font-medium">Programme</th>
                <th className="px-3 py-2 font-medium">Will set department</th>
              </tr>
            </thead>
            <tbody>
              {preview.sample.map((row) => (
                <tr key={row.studentId} className="border-t border-border/50">
                  <td className="px-3 py-2">{row.fullName ?? '—'}</td>
                  <td className="px-3 py-2 font-mono">{row.rollNumber ?? row.enrollmentNumber}</td>
                  <td className="px-3 py-2">{row.programme ?? '—'}</td>
                  <td className="px-3 py-2 font-medium">{row.targetDepartment}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {preview.eligible > preview.sample.length ? (
            <p className="border-t border-border/50 px-3 py-2 text-[11px] text-muted-foreground">
              Showing {preview.sample.length} of {preview.eligible} eligible students
            </p>
          ) : null}
        </div>
      ) : null}

      {applyMut.isError ? (
        <p className="mt-3 text-sm text-destructive">
          {apiErrorMessage(applyMut.error, 'Backfill failed')}
        </p>
      ) : null}

      {result ? (
        <p className="mt-3 rounded-xl bg-primary/5 px-3 py-2 text-sm text-foreground">
          Updated <strong>{result.updated}</strong> student
          {result.updated === 1 ? '' : 's'}. Skipped {result.skipped}
          {result.errors ? ` · ${result.errors} error(s)` : ''}.
        </p>
      ) : null}
    </section>
  );
}

function Stat({ label, value, emphasis }: { label: string; value: number; emphasis?: boolean }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-background/60 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${emphasis ? 'text-primary' : ''}`}>
        {value}
      </p>
    </div>
  );
}
