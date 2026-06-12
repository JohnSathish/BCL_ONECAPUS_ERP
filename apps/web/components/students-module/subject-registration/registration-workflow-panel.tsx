'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  fetchRegistrationWorkflow,
  updateRegistrationWorkflow,
  type RegistrationWorkflowSettings,
} from '@/services/admin-registration';

const POOL_ELECTIVE_CATEGORIES = [
  'MDC',
  'AEC',
  'SEC',
  'VAC',
  'VTC',
  'INTERNSHIP',
  'DISSERTATION',
] as const;

type RegistrationWorkflowPanelProps = {
  institutionId: string;
};

export function RegistrationWorkflowPanel({ institutionId }: RegistrationWorkflowPanelProps) {
  const qc = useQueryClient();
  const workflow = useQuery({
    queryKey: ['registration-workflow', institutionId],
    queryFn: () => fetchRegistrationWorkflow(institutionId),
    enabled: Boolean(institutionId),
  });

  const saveMut = useMutation({
    mutationFn: (payload: Partial<RegistrationWorkflowSettings>) =>
      updateRegistrationWorkflow(institutionId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['registration-workflow', institutionId] });
    },
  });

  const settings = workflow.data;
  if (!settings || !institutionId) return null;

  const toggleElective = (cat: string) => {
    const next = settings.studentElectiveCategories.includes(cat)
      ? settings.studentElectiveCategories.filter((c) => c !== cat)
      : [...settings.studentElectiveCategories, cat];
    saveMut.mutate({ studentElectiveCategories: next });
  };

  return (
    <div className="rounded-md border border-border bg-muted/20 p-3 space-y-3">
      <p className="text-xs font-medium text-muted-foreground">Registration workflow</p>
      <div className="flex flex-wrap gap-2">
        {(['ADMIN_ONLY', 'STUDENT_SELF', 'HYBRID'] as const).map((mode) => (
          <Button
            key={mode}
            type="button"
            size="sm"
            variant={settings.mode === mode ? 'default' : 'outline'}
            disabled={saveMut.isPending}
            onClick={() => saveMut.mutate({ mode })}
          >
            {mode.replace('_', ' ')}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {POOL_ELECTIVE_CATEGORIES.map((cat) => (
          <label
            key={cat}
            className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs"
          >
            <input
              type="checkbox"
              checked={settings.studentElectiveCategories.includes(cat)}
              onChange={() => toggleElective(cat)}
              disabled={saveMut.isPending}
            />
            {cat}
          </label>
        ))}
      </div>
      {saveMut.isError ? (
        <p className="text-xs text-destructive">Could not save workflow settings.</p>
      ) : null}
    </div>
  );
}
