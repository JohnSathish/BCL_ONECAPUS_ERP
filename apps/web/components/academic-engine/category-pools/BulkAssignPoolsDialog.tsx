'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  assignCategoryPool,
  fetchCategoryPool,
  previewAssignCategoryPool,
} from '@/services/academic-engine';
import { fetchPrograms } from '@/services/programs';
import type { AssignPoolPayload, PoolAssignPreviewResult } from '@/types/academic-engine';
import {
  buildProgramOptions,
  buildVersionOptions,
} from '@/components/academic-engine/structure/structure-types';

type BulkAssignPoolsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  poolId: string;
  onAssigned?: () => void;
};

export function BulkAssignPoolsDialog({
  open,
  onOpenChange,
  poolId,
  onAssigned,
}: BulkAssignPoolsDialogProps) {
  const [step, setStep] = useState<'configure' | 'preview'>('configure');
  const [mode, setMode] = useState<AssignPoolPayload['mode']>('ALL_UG');
  const [selectedProgramIds, setSelectedProgramIds] = useState<string[]>([]);
  const [selectedVersionIds, setSelectedVersionIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<PoolAssignPreviewResult | null>(null);

  const poolQuery = useQuery({
    queryKey: ['academic-engine', 'category-pool', poolId],
    queryFn: () => fetchCategoryPool(poolId),
    enabled: open,
  });

  const programsQuery = useQuery({
    queryKey: ['catalog', 'programs', 'pool-assign'],
    queryFn: () => fetchPrograms(1),
    enabled: open,
  });

  const programOptions = useMemo(
    () => buildProgramOptions(programsQuery.data?.data ?? []),
    [programsQuery.data],
  );

  const versionOptions = useMemo(() => buildVersionOptions(programOptions), [programOptions]);

  const ugPrograms = useMemo(
    () => programOptions.filter((program) => (program.level ?? 'UG') === 'UG'),
    [programOptions],
  );

  useEffect(() => {
    if (!open) {
      setStep('configure');
      setMode('ALL_UG');
      setSelectedProgramIds([]);
      setSelectedVersionIds([]);
      setPreview(null);
    }
  }, [open]);

  const buildPayload = (): AssignPoolPayload => ({
    mode,
    ...(mode === 'SELECTED_PROGRAMS' ? { programIds: selectedProgramIds } : {}),
    ...(mode === 'SELECTED_VERSIONS' ? { programVersionIds: selectedVersionIds } : {}),
  });

  const previewMut = useMutation({
    mutationFn: () => previewAssignCategoryPool(poolId, buildPayload()),
    onSuccess: (data) => {
      setPreview(data);
      setStep('preview');
    },
  });

  const applyMut = useMutation({
    mutationFn: () => assignCategoryPool(poolId, buildPayload()),
    onSuccess: () => {
      onAssigned?.();
      onOpenChange(false);
    },
  });

  const toggleProgram = (programId: string) => {
    setSelectedProgramIds((prev) =>
      prev.includes(programId) ? prev.filter((id) => id !== programId) : [...prev, programId],
    );
  };

  const toggleVersion = (versionId: string) => {
    setSelectedVersionIds((prev) =>
      prev.includes(versionId) ? prev.filter((id) => id !== versionId) : [...prev, versionId],
    );
  };

  const canPreview =
    mode === 'ALL_UG' ||
    (mode === 'SELECTED_PROGRAMS' && selectedProgramIds.length > 0) ||
    (mode === 'SELECTED_VERSIONS' && selectedVersionIds.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign pool to programmes</DialogTitle>
          <DialogDescription>
            {poolQuery.data?.poolName ?? 'Pool'} · Semester {poolQuery.data?.semesterNo} ·{' '}
            {poolQuery.data?.categoryType}
          </DialogDescription>
        </DialogHeader>

        {step === 'configure' ? (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Apply scope</p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['ALL_UG', 'All UG programmes'],
                    ['SELECTED_PROGRAMS', 'Selected programmes'],
                    ['SELECTED_VERSIONS', 'Selected programme versions'],
                  ] as const
                ).map(([value, label]) => (
                  <label
                    key={value}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-xs"
                  >
                    <input
                      type="radio"
                      name="pool-assign-mode"
                      checked={mode === value}
                      onChange={() => setMode(value)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            {mode === 'SELECTED_PROGRAMS' ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Assigns this pool to all versions of each selected programme.
                </p>
                {programsQuery.isLoading ? (
                  <p className="text-xs text-muted-foreground">Loading programmes…</p>
                ) : programOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No programmes found.</p>
                ) : (
                  <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                    {programOptions.map((program) => (
                      <label key={program.id} className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={selectedProgramIds.includes(program.id)}
                          onChange={() => toggleProgram(program.id)}
                        />
                        {program.code} — {program.name}
                        {program.versions.length > 0 ? (
                          <span className="text-muted-foreground">
                            ({program.versions.length} version
                            {program.versions.length === 1 ? '' : 's'})
                          </span>
                        ) : null}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {mode === 'SELECTED_VERSIONS' ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Assign only to the specific programme versions you select.
                </p>
                {programsQuery.isLoading ? (
                  <p className="text-xs text-muted-foreground">Loading programme versions…</p>
                ) : versionOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No programme versions found.</p>
                ) : (
                  <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                    {versionOptions.map((version) => (
                      <label key={version.id} className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={selectedVersionIds.includes(version.id)}
                          onChange={() => toggleVersion(version.id)}
                        />
                        {version.label}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {mode === 'ALL_UG' ? (
              <p className="text-xs text-muted-foreground">
                Will target {ugPrograms.length} UG programme(s) and all their versions.
              </p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!canPreview || previewMut.isPending}
                onClick={() => previewMut.mutate()}
              >
                {previewMut.isPending ? 'Previewing…' : 'Preview assign'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {preview?.items.filter((item) => item.assigned).length ?? 0} will be assigned ·{' '}
              {preview?.items.filter((item) => !item.assigned).length ?? 0} skipped
            </p>
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {preview?.items.map((item) => (
                <div
                  key={item.programVersionId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-2 text-xs"
                >
                  <span>
                    {item.programCode} v{item.version} — {item.programName}
                  </span>
                  {item.assigned ? (
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-primary">Assign</span>
                  ) : (
                    <span className="rounded bg-muted px-2 py-0.5 text-muted-foreground">
                      Skip{item.skippedReason ? `: ${item.skippedReason}` : ''}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep('configure')}>
                Back
              </Button>
              <Button
                size="sm"
                disabled={applyMut.isPending || !preview?.items.some((item) => item.assigned)}
                onClick={() => applyMut.mutate()}
              >
                {applyMut.isPending ? 'Assigning…' : 'Confirm assign'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
