'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchGovernanceCommittees } from '@/services/governance';
import { fetchAcademicDepartments, fetchAcademicYears } from '@/services/organization';
import { fetchNaacMetrics } from '@/services/naac-iqac';
import { fetchPrograms } from '@/services/programs';
import { NAAC_CRITERIA_OPTIONS, type NaacEvidenceTagFormValues } from '@/types/naac-evidence';

export const selectClass =
  'mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

type Props = {
  values: NaacEvidenceTagFormValues;
  onChange: (values: NaacEvidenceTagFormValues) => void;
  defaultAcademicYear?: string;
  idPrefix?: string;
};

export function EvidenceTagFields({
  values,
  onChange,
  defaultAcademicYear = '2025-26',
  idPrefix = 'naac',
}: Props) {
  const enabled = useAuthQueryEnabled();

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

  function update<K extends keyof NaacEvidenceTagFormValues>(
    key: K,
    value: NaacEvidenceTagFormValues[K],
  ) {
    const next = { ...values, [key]: value };
    if (key === 'criterion') next.metricCode = '';
    onChange(next);
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <Label htmlFor={`${idPrefix}-criterion`}>Criterion *</Label>
        <select
          id={`${idPrefix}-criterion`}
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
        <Label htmlFor={`${idPrefix}-metric`}>Metric</Label>
        <select
          id={`${idPrefix}-metric`}
          className={selectClass}
          value={values.metricCode}
          onChange={(e) => update('metricCode', e.target.value)}
          disabled={metricsQ.isLoading}
        >
          <option value="">— Select metric (optional) —</option>
          {(metricsQ.data ?? []).map((m) => (
            <option key={m.id} value={m.code}>
              {m.code} — {m.title}
              {m.isMandatory ? ' *' : ''}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label htmlFor={`${idPrefix}-year`}>Academic year *</Label>
        <select
          id={`${idPrefix}-year`}
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
        <Label htmlFor={`${idPrefix}-department`}>Department</Label>
        <select
          id={`${idPrefix}-department`}
          className={selectClass}
          value={values.departmentId}
          onChange={(e) => update('departmentId', e.target.value)}
        >
          <option value="">— All / institution-wide —</option>
          {(departmentsQ.data ?? []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.code} — {d.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label htmlFor={`${idPrefix}-committee`}>Committee</Label>
        <select
          id={`${idPrefix}-committee`}
          className={selectClass}
          value={values.committeeId}
          onChange={(e) => update('committeeId', e.target.value)}
        >
          <option value="">— None —</option>
          {(committeesQ.data?.items ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.shortCode ?? c.name} — {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label htmlFor={`${idPrefix}-programme`}>Programme</Label>
        <select
          id={`${idPrefix}-programme`}
          className={selectClass}
          value={values.programmeId}
          onChange={(e) => update('programmeId', e.target.value)}
        >
          <option value="">— None —</option>
          {(programsQ.data?.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} — {p.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label htmlFor={`${idPrefix}-activity`}>Activity</Label>
        <Input
          id={`${idPrefix}-activity`}
          placeholder="e.g. NSS Village Adoption"
          value={values.activityTitle}
          onChange={(e) => update('activityTitle', e.target.value)}
        />
      </div>

      <div>
        <Label htmlFor={`${idPrefix}-event`}>Event</Label>
        <Input
          id={`${idPrefix}-event`}
          placeholder="e.g. IQAC Quarterly Meeting"
          value={values.eventTitle}
          onChange={(e) => update('eventTitle', e.target.value)}
        />
      </div>

      <div className="md:col-span-2">
        <Label htmlFor={`${idPrefix}-notes`}>Evidence notes</Label>
        <textarea
          id={`${idPrefix}-notes`}
          className={`${selectClass} min-h-[72px] resize-y`}
          placeholder="What this evidence proves for NAAC/DVV"
          value={values.evidenceNotes}
          onChange={(e) => update('evidenceNotes', e.target.value)}
        />
      </div>
    </div>
  );
}
