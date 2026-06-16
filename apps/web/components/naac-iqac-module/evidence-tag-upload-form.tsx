'use client';

import { useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EvidenceTagFields } from '@/components/naac-iqac-module/evidence-tag-fields';
import {
  buildNaacEvidenceTagFormData,
  type NaacEvidenceTagFormValues,
} from '@/types/naac-evidence';

const emptyForm = (academicYear: string): NaacEvidenceTagFormValues => ({
  criterion: 3,
  academicYear,
  metricCode: '',
  departmentId: '',
  committeeId: '',
  programmeId: '',
  activityTitle: '',
  eventTitle: '',
  evidenceNotes: '',
});

type Props = {
  defaultAcademicYear?: string;
  onSubmit: (form: FormData) => void;
  isPending?: boolean;
  title?: string;
  description?: string;
};

export function EvidenceTagUploadForm({
  defaultAcademicYear = '2025-26',
  onSubmit,
  isPending,
  title = 'Upload evidence with NAAC tags',
  description = 'Every field except the file helps IQAC search and assemble AQAR/SSR evidence packs. Criterion and academic year are required.',
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [values, setValues] = useState<NaacEvidenceTagFormValues>(() =>
    emptyForm(defaultAcademicYear),
  );

  const canSubmit =
    !!file &&
    values.criterion >= 1 &&
    values.criterion <= 7 &&
    values.academicYear.trim().length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !canSubmit) return;
    onSubmit(buildNaacEvidenceTagFormData(file, values));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="naac-evidence-file">Evidence file *</Label>
            <Input
              id="naac-evidence-file"
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.ppt,.pptx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && (
              <p className="text-xs text-muted-foreground">
                {file.name} ({Math.round(file.size / 1024)} KB)
              </p>
            )}
          </div>

          <EvidenceTagFields
            values={values}
            onChange={setValues}
            defaultAcademicYear={defaultAcademicYear}
          />

          <Button type="submit" disabled={!canSubmit || isPending}>
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Upload &amp; tag evidence
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
