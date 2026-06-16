'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Award, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createNaacEvidenceTag } from '@/services/naac-iqac';
import type { NaacEvidenceTagFormValues } from '@/types/naac-evidence';
import { EvidenceTagFields } from '@/components/naac-iqac-module/evidence-tag-fields';
import { apiErrorMessage } from '@/utils/api-error';

const emptyTag = (year: string): NaacEvidenceTagFormValues => ({
  criterion: 3,
  academicYear: year,
  metricCode: '',
  departmentId: '',
  committeeId: '',
  programmeId: '',
  activityTitle: '',
  eventTitle: '',
  evidenceNotes: '',
});

type Props = {
  sourceType: string;
  sourceId: string;
  label?: string;
  defaultAcademicYear?: string;
  defaultCriterion?: number;
  fileName?: string;
  fileUrl?: string;
  storageKey?: string;
  defaultDepartmentId?: string;
  defaultActivityTitle?: string;
  defaultEvidenceNotes?: string;
  size?: 'sm' | 'default';
};

export function NaacEvidenceTagButton({
  sourceType,
  sourceId,
  label = 'Tag for NAAC',
  defaultAcademicYear = '2025-26',
  defaultCriterion = 3,
  fileName,
  fileUrl,
  storageKey,
  defaultDepartmentId,
  defaultActivityTitle,
  defaultEvidenceNotes,
  size = 'sm',
}: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [values, setValues] = useState<NaacEvidenceTagFormValues>(() => ({
    ...emptyTag(defaultAcademicYear),
    criterion: defaultCriterion,
    departmentId: defaultDepartmentId ?? '',
    activityTitle: defaultActivityTitle ?? '',
    evidenceNotes: defaultEvidenceNotes ?? '',
  }));

  const tagMut = useMutation({
    mutationFn: () =>
      createNaacEvidenceTag({
        sourceType,
        sourceId,
        criterion: values.criterion,
        academicYear: values.academicYear,
        metricCode: values.metricCode || undefined,
        departmentId: values.departmentId || undefined,
        committeeId: values.committeeId || undefined,
        programmeId: values.programmeId || undefined,
        activityTitle: values.activityTitle || undefined,
        eventTitle: values.eventTitle || undefined,
        evidenceNotes: values.evidenceNotes || undefined,
        fileName,
        fileUrl,
        storageKey,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['naac-evidence'] });
      qc.invalidateQueries({ queryKey: ['naac-dashboard'] });
      setOpen(false);
      setError('');
    },
    onError: (e) => setError(apiErrorMessage(e, 'Tag failed')),
  });

  if (!open) {
    return (
      <Button type="button" variant="outline" size={size} onClick={() => setOpen(true)}>
        <Award className="mr-1 h-3 w-3" />
        {label}
      </Button>
    );
  }

  return (
    <Card className="mt-2 border-dashed">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm">NAAC evidence tag</CardTitle>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Link <span className="font-mono">{sourceType}</span> to NAAC criteria without
          re-uploading.
        </p>
        <EvidenceTagFields
          values={values}
          onChange={setValues}
          defaultAcademicYear={defaultAcademicYear}
          idPrefix={`tag-${sourceId.slice(0, 8)}`}
        />
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        <Button type="button" size="sm" disabled={tagMut.isPending} onClick={() => tagMut.mutate()}>
          {tagMut.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Award className="mr-2 h-4 w-4" />
          )}
          Save NAAC tag
        </Button>
      </CardContent>
    </Card>
  );
}
