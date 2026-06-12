'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  applyFyugpTemplate,
  fetchFyugpTemplates,
  previewApplyFyugpTemplate,
} from '@/services/academic-engine';
import type { ApplyFyugpTemplatePayload, ApplyPreviewResult } from '@/types/academic-engine';
import type { ProgramOption } from './structure-types';

type ApplyTemplateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  programs: ProgramOption[];
  initialMode?: ApplyFyugpTemplatePayload['mode'];
};

export function ApplyTemplateDialog({
  open,
  onOpenChange,
  templateId,
  programs,
  initialMode = 'ALL_UG',
}: ApplyTemplateDialogProps) {
  const qc = useQueryClient();
  const [step, setStep] = useState<'configure' | 'preview'>('configure');
  const [mode, setMode] = useState<ApplyFyugpTemplatePayload['mode']>(initialMode);
  const [conflictStrategy, setConflictStrategy] =
    useState<ApplyFyugpTemplatePayload['conflictStrategy']>('REPLACE_ALL');
  const [selectedProgramIds, setSelectedProgramIds] = useState<string[]>([]);
  const [selectedVersionIds, setSelectedVersionIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<ApplyPreviewResult | null>(null);

  const templatesQuery = useQuery({
    queryKey: ['academic-engine', 'fyugp-templates'],
    queryFn: () => fetchFyugpTemplates(true),
    enabled: open,
  });

  const selectedTemplate = templatesQuery.data?.find((template) => template.id === templateId);

  const ugPrograms = useMemo(
    () => programs.filter((program) => (program.level ?? 'UG') === 'UG'),
    [programs],
  );

  const allVersions = useMemo(() => programs.flatMap((program) => program.versions), [programs]);

  useEffect(() => {
    if (!open) {
      setStep('configure');
      setMode(initialMode);
      setConflictStrategy('REPLACE_ALL');
      setSelectedProgramIds([]);
      setSelectedVersionIds([]);
      setPreview(null);
    }
  }, [open, initialMode]);

  const buildPayload = (): ApplyFyugpTemplatePayload => ({
    mode,
    conflictStrategy,
    ...(mode === 'SELECTED_PROGRAMS' ? { programIds: selectedProgramIds } : {}),
    ...(mode === 'SELECTED_VERSIONS' ? { programVersionIds: selectedVersionIds } : {}),
  });

  const previewMut = useMutation({
    mutationFn: () => previewApplyFyugpTemplate(templateId, buildPayload()),
    onSuccess: (data) => {
      setPreview(data);
      setStep('preview');
    },
  });

  const applyMut = useMutation({
    mutationFn: () => applyFyugpTemplate(templateId, buildPayload()),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['academic-engine', 'structure'] });
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
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Apply FYUGP template</DialogTitle>
          <DialogDescription>
            {selectedTemplate?.templateName ?? 'Template'} · preview changes before applying to
            programme versions.
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
                      name="apply-mode"
                      checked={mode === value}
                      onChange={() => setMode(value)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            {mode === 'SELECTED_PROGRAMS' ? (
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                {programs.map((program) => (
                  <label key={program.id} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={selectedProgramIds.includes(program.id)}
                      onChange={() => toggleProgram(program.id)}
                    />
                    {program.code} — {program.name}
                  </label>
                ))}
              </div>
            ) : null}

            {mode === 'SELECTED_VERSIONS' ? (
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                {allVersions.map((version) => (
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
            ) : null}

            {mode === 'ALL_UG' ? (
              <p className="text-xs text-muted-foreground">
                Will target {ugPrograms.length} UG programme(s) and all their versions.
              </p>
            ) : null}

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Existing structure rules
              </p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['REPLACE_ALL', 'Replace all existing rules'],
                    ['SKIP_EXISTING', 'Skip versions with existing rules'],
                  ] as const
                ).map(([value, label]) => (
                  <label
                    key={value}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-xs"
                  >
                    <input
                      type="radio"
                      name="conflict-strategy"
                      checked={conflictStrategy === value}
                      onChange={() => setConflictStrategy(value)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!canPreview || previewMut.isPending}
                onClick={() => previewMut.mutate()}
              >
                {previewMut.isPending ? 'Previewing…' : 'Preview apply'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {preview?.items.filter((item) => !item.skipped).length ?? 0} version(s) will be
              updated · {preview?.items.filter((item) => item.skipped).length ?? 0} skipped
            </p>
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {preview?.items.map((item) => (
                <div
                  key={item.programVersionId}
                  className="rounded-md border border-border p-3 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">
                      {item.programCode} v{item.version} — {item.programName}
                    </p>
                    {item.skipped ? (
                      <span className="rounded bg-muted px-2 py-0.5 text-muted-foreground">
                        Skipped{item.skippedReason ? `: ${item.skippedReason}` : ''}
                      </span>
                    ) : (
                      <span className="rounded bg-primary/10 px-2 py-0.5 text-primary">
                        {item.changedSemesters.length
                          ? `Semesters ${item.changedSemesters.join(', ')}`
                          : 'No changes'}
                      </span>
                    )}
                  </div>
                  {!item.skipped && item.changedSemesters.length ? (
                    <div className="mt-2 grid gap-2 lg:grid-cols-2">
                      {item.changedSemesters.map((semester) => {
                        const current = item.currentRules.find(
                          (rule) => rule.semesterSequence === semester,
                        );
                        const proposed = item.proposedRules.find(
                          (rule) => rule.semesterSequence === semester,
                        );
                        return (
                          <div key={semester} className="rounded border border-border/60 p-2">
                            <p className="mb-1 font-medium">Semester {semester}</p>
                            <p className="text-muted-foreground">
                              Current: {formatRuleSummary(current)}
                            </p>
                            <p>Proposed: {formatRuleSummary(proposed)}</p>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            {conflictStrategy === 'REPLACE_ALL' ? (
              <p className="text-xs text-amber-700">
                Replace all will overwrite existing semester structure rules on affected versions.
              </p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep('configure')}>
                Back
              </Button>
              <Button
                size="sm"
                disabled={applyMut.isPending || !preview?.items.some((item) => !item.skipped)}
                onClick={() => applyMut.mutate()}
              >
                {applyMut.isPending ? 'Applying…' : 'Confirm apply'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function formatRuleSummary(rule?: {
  categoryCounts: Record<string, number>;
  continuityRules: Record<string, string>;
}) {
  if (!rule) return '—';
  const counts = Object.entries(rule.categoryCounts)
    .filter(([, count]) => count > 0)
    .map(([cat, count]) => `${cat}:${count}`)
    .join(', ');
  return counts || 'empty';
}
