'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchGovernanceCommittees } from '@/services/governance';
import { fetchAcademicDepartments, fetchAcademicYears } from '@/services/organization';
import { fetchNaacMetrics } from '@/services/naac-iqac';
import { fetchPrograms } from '@/services/programs';
import {
  buildNaacEvidenceTagFormData,
  NAAC_CRITERIA_OPTIONS,
  type NaacEvidenceTagFormValues,
} from '@/types/naac-evidence';

const selectClass =
  'mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

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
  const enabled = useAuthQueryEnabled();
  const [file, setFile] = useState<File | null>(null);
  const [values, setValues] = useState<NaacEvidenceTagFormValues>(() =>
    emptyForm(defaultAcademicYear),
  );

  const metricsQ = useQuery({
    queryKey: ['naac-metrics', values.criterion],
    queryFn: () => fetchNaacMetrics(values.criterion),
    enabled: enabled && values.criterion > 0,
  });

  const departmentsQ = useQuery({
    queryKey: ['naac-tag-departments'],
    queryFn: () => fetchAcademicDepartments(),
    enabled,
  });

  const committeesQ = useQuery({
    queryKey: ['naac-tag-committees'],
    queryFn: () => fetchGovernanceCommittees({ limit: 100 }),
    enabled,
  });

  const programsQ = useQuery({
    queryKey: ['naac-tag-programs'],
    queryFn: () => fetchPrograms(1),
    enabled,
  });

  const yearsQ = useQuery({
    queryKey: ['naac-academic-years'],
    queryFn: fetchAcademicYears,
    enabled,
  });

  const yearOptions = useMemo(() => {
    const fromApi = (yearsQ.data ?? []).map((y) => y.name).filter(Boolean);
    const merged = new Set([defaultAcademicYear, values.academicYear, ...fromApi]);
    return Array.from(merged);
  }, [yearsQ.data, defaultAcademicYear, values.academicYear]);

  const metrics = metricsQ.data ?? [];
  const departments = departmentsQ.data ?? [];
  const committees = committeesQ.data?.items ?? [];
  const programs = programsQ.data?.items ?? [];

  const canSubmit =
    !!file &&
    values.criterion >= 1 &&
    values.criterion <= 7 &&
    values.academicYear.trim().length > 0;

  function update<K extends keyof NaacEvidenceTagFormValues>(
    key: K,
    value: NaacEvidenceTagFormValues[K],
  ) {
    setValues((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'criterion') next.metricCode = '';
      return next;
    });
  }

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

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="naac-criterion">Criterion *</Label>
              <select
                id="naac-criterion"
                className={selectClass}
                value={values.criterion}
                onChange={(e) => update('criterion', Number(e.target.value))}
              >
                {NAAC_CRITERIA_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="naac-metric">Metric</Label>
              <select
                id="naac-metric"
                className={selectClass}
                value={values.metricCode}
                onChange={(e) => update('metricCode', e.target.value)}
                disabled={metricsQ.isLoading}
              >
                <option value="">— Select metric (optional) —</option>
                {metrics.map((m) => (
                  <option key={m.id} value={m.code}>
                    {m.code} — {m.title}
                    {m.isMandatory ? ' *' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="naac-year">Academic year *</Label>
              <select
                id="naac-year"
                className={selectClass}
                value={values.academicYear}
                onChange={(e) => update('academicYear', e.target.value)}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="naac-department">Department</Label>
              <select
                id="naac-department"
                className={selectClass}
                value={values.departmentId}
                onChange={(e) => update('departmentId', e.target.value)}
              >
                <option value="">— All / institution-wide —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} — {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="naac-committee">Committee</Label>
              <select
                id="naac-committee"
                className={selectClass}
                value={values.committeeId}
                onChange={(e) => update('committeeId', e.target.value)}
              >
                <option value="">— None —</option>
                {committees.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.shortCode ?? c.name} — {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="naac-programme">Programme</Label>
              <select
                id="naac-programme"
                className={selectClass}
                value={values.programmeId}
                onChange={(e) => update('programmeId', e.target.value)}
              >
                <option value="">— None —</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="naac-activity">Activity</Label>
              <Input
                id="naac-activity"
                placeholder="e.g. NSS Village Adoption, FDP on Research"
                value={values.activityTitle}
                onChange={(e) => update('activityTitle', e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="naac-event">Event</Label>
              <Input
                id="naac-event"
                placeholder="e.g. Annual IQAC Meeting, Science Exhibition"
                value={values.eventTitle}
                onChange={(e) => update('eventTitle', e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="naac-notes">Evidence notes</Label>
            <textarea
              id="naac-notes"
              className={`${selectClass} min-h-[88px] resize-y`}
              placeholder="Brief description for DVV reviewers — what this document proves"
              value={values.evidenceNotes}
              onChange={(e) => update('evidenceNotes', e.target.value)}
            />
          </div>

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
