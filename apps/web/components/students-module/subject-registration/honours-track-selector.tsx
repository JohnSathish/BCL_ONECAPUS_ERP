'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  fetchStudentAcademicTrack,
  setStudentAcademicTrack,
  updateAggregateThroughSem6,
} from '@/services/academic-engine';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

type Props = {
  studentId: string;
  semesterSequence: number;
  className?: string;
  onTrackChange?: (track: 'HONOURS' | 'HONOURS_WITH_RESEARCH') => void;
};

export function HonoursTrackSelector({
  studentId,
  semesterSequence,
  className,
  onTrackChange,
}: Props) {
  const qc = useQueryClient();
  const enabled = Boolean(studentId) && semesterSequence >= 8;
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [aggregateDraft, setAggregateDraft] = useState('');
  const [error, setError] = useState('');

  const trackQuery = useQuery({
    queryKey: ['fyugp', 'academic-track', studentId, semesterSequence],
    queryFn: () => fetchStudentAcademicTrack(studentId, semesterSequence),
    enabled,
  });

  const saveMut = useMutation({
    mutationFn: (payload: {
      track: 'HONOURS' | 'HONOURS_WITH_RESEARCH';
      eligibilityOverride?: boolean;
      eligibilityOverrideReason?: string;
    }) =>
      setStudentAcademicTrack(studentId, {
        ...payload,
        effectiveFromSemester: semesterSequence,
      }),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['fyugp', 'academic-track', studentId] });
      setOverrideOpen(false);
      setOverrideReason('');
      setError('');
      onTrackChange?.(data.track as 'HONOURS' | 'HONOURS_WITH_RESEARCH');
    },
    onError: (e) => setError(apiErrorMessage(e, 'Could not save pathway')),
  });

  const aggregateMut = useMutation({
    mutationFn: (value: number) => updateAggregateThroughSem6(studentId, value),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['fyugp', 'academic-track', studentId] });
      setAggregateDraft('');
      setError('');
    },
    onError: (e) => setError(apiErrorMessage(e, 'Could not save aggregate %')),
  });

  if (!enabled) return null;

  const currentTrack = trackQuery.data?.track ?? 'HONOURS';
  const aggregate = trackQuery.data?.aggregatePercentageThroughSem6;
  const threshold = trackQuery.data?.researchEligibilityPercent ?? 75;
  const researchEligible = aggregate != null && Number(aggregate) >= threshold;
  const blockReason = trackQuery.data?.eligibility?.blockReason;

  const selectHonours = () => {
    setError('');
    saveMut.mutate({ track: 'HONOURS' });
  };

  const selectResearch = () => {
    setError('');
    if (researchEligible) {
      saveMut.mutate({ track: 'HONOURS_WITH_RESEARCH' });
      return;
    }
    setOverrideOpen(true);
  };

  const confirmOverride = () => {
    if (overrideReason.trim().length < 5) {
      setError('Override reason must be at least 5 characters.');
      return;
    }
    saveMut.mutate({
      track: 'HONOURS_WITH_RESEARCH',
      eligibilityOverride: true,
      eligibilityOverrideReason: overrideReason.trim(),
    });
  };

  const saveAggregate = () => {
    const value = Number(aggregateDraft);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      setError('Aggregate % must be between 0 and 100.');
      return;
    }
    setError('');
    aggregateMut.mutate(value);
  };

  return (
    <div className={cn('rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2', className)}>
      <div>
        <p className="text-sm font-semibold">Semester 8 honours pathway</p>
        <p className="text-[11px] text-muted-foreground">
          NEHU-attested aggregate through Semester 6:{' '}
          {aggregate != null ? `${aggregate}%` : 'Not recorded'}
          {aggregate != null ? ` (Research needs ≥ ${threshold}%)` : ''}
        </p>
      </div>

      {aggregate == null ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="space-y-1 text-[11px]">
            <span className="font-medium">Enter attested aggregate %</span>
            <input
              type="number"
              min={0}
              max={100}
              step={0.01}
              className="block w-28 rounded-md border border-border bg-background px-2 py-1 text-xs"
              value={aggregateDraft}
              onChange={(e) => setAggregateDraft(e.target.value)}
              placeholder="0–100"
            />
          </label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={aggregateMut.isPending}
            onClick={saveAggregate}
          >
            Save %
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={currentTrack === 'HONOURS' ? 'default' : 'outline'}
          disabled={saveMut.isPending}
          onClick={selectHonours}
        >
          UG Honours (Advanced Major)
        </Button>
        <Button
          type="button"
          size="sm"
          variant={currentTrack === 'HONOURS_WITH_RESEARCH' ? 'default' : 'outline'}
          disabled={saveMut.isPending}
          onClick={selectResearch}
          title={
            researchEligible
              ? 'Eligible for Honours with Research'
              : 'Requires ≥75% or principal override'
          }
        >
          Honours with Research
          {!researchEligible ? ' (override)' : ''}
        </Button>
      </div>

      {!researchEligible ? (
        <p className="text-[11px] text-amber-700 dark:text-amber-300">
          {blockReason ??
            (aggregate == null
              ? 'Enter attested Sem-6 aggregate before Research, or use principal override.'
              : `Below ${threshold}% — Research needs principal override with reason.`)}
        </p>
      ) : null}

      {overrideOpen ? (
        <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-2">
          <p className="text-[11px] font-medium text-amber-900 dark:text-amber-200">
            Principal override — document why Research is allowed despite eligibility.
          </p>
          <textarea
            className="min-h-[64px] w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
            placeholder="Override reason (required)"
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
          />
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={saveMut.isPending} onClick={confirmOverride}>
              Confirm Research override
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={saveMut.isPending}
              onClick={() => {
                setOverrideOpen(false);
                setOverrideReason('');
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
    </div>
  );
}
