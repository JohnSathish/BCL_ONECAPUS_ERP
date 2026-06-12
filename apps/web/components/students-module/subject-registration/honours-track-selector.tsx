'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { fetchStudentAcademicTrack, setStudentAcademicTrack } from '@/services/academic-engine';
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

  const trackQuery = useQuery({
    queryKey: ['fyugp', 'academic-track', studentId, semesterSequence],
    queryFn: () => fetchStudentAcademicTrack(studentId, semesterSequence),
    enabled,
  });

  const saveMut = useMutation({
    mutationFn: (payload: {
      track: 'HONOURS' | 'HONOURS_WITH_RESEARCH';
      eligibilityOverride?: boolean;
    }) =>
      setStudentAcademicTrack(studentId, { ...payload, effectiveFromSemester: semesterSequence }),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['fyugp', 'academic-track', studentId] });
      onTrackChange?.(data.track as 'HONOURS' | 'HONOURS_WITH_RESEARCH');
    },
  });

  if (!enabled) return null;

  const currentTrack = trackQuery.data?.track ?? 'HONOURS';
  const aggregate = trackQuery.data?.aggregatePercentageThroughSem6;
  const warning = trackQuery.data?.eligibility?.warning;

  return (
    <div className={cn('rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2', className)}>
      <div>
        <p className="text-sm font-semibold">Semester 8 honours pathway</p>
        <p className="text-[11px] text-muted-foreground">
          Aggregate through Semester 6: {aggregate != null ? `${aggregate}%` : 'Not recorded'}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['HONOURS', 'UG Honours (Advanced Major)'],
            ['HONOURS_WITH_RESEARCH', 'Honours with Research'],
          ] as const
        ).map(([track, label]) => (
          <Button
            key={track}
            type="button"
            size="sm"
            variant={currentTrack === track ? 'default' : 'outline'}
            disabled={saveMut.isPending}
            onClick={() =>
              saveMut.mutate({
                track,
                eligibilityOverride: track === 'HONOURS_WITH_RESEARCH' && Boolean(warning),
              })
            }
          >
            {label}
          </Button>
        ))}
      </div>

      {warning ? <p className="text-[11px] text-amber-700 dark:text-amber-300">{warning}</p> : null}
    </div>
  );
}
