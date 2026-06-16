'use client';

import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchNaacMetrics } from '@/services/naac-iqac';
import { NAAC_CRITERIA_OPTIONS } from '@/types/naac-evidence';
import { selectClass } from '@/components/naac-iqac-module/evidence-tag-fields';

export type AchievementFormValues = {
  achievementType: string;
  title: string;
  description: string;
  achievementDate: string;
  criterion: number;
  academicYear: string;
  metricCode: string;
};

export function AchievementMetadataFields({
  values,
  onChange,
  achievementTypes,
  idPrefix = 'achievement',
}: {
  values: AchievementFormValues;
  onChange: (v: AchievementFormValues) => void;
  achievementTypes: string[];
  idPrefix?: string;
}) {
  const enabled = useAuthQueryEnabled();
  const metricsQ = useQuery({
    queryKey: ['naac-metrics', values.criterion],
    queryFn: () => fetchNaacMetrics(values.criterion),
    enabled: enabled && values.criterion > 0,
  });

  function update<K extends keyof AchievementFormValues>(key: K, value: AchievementFormValues[K]) {
    const next = { ...values, [key]: value };
    if (key === 'criterion') next.metricCode = '';
    onChange(next);
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div>
        <Label htmlFor={`${idPrefix}-type`}>Achievement type *</Label>
        <select
          id={`${idPrefix}-type`}
          className={selectClass}
          value={values.achievementType}
          onChange={(e) => update('achievementType', e.target.value)}
        >
          {achievementTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-date`}>Date</Label>
        <Input
          id={`${idPrefix}-date`}
          type="date"
          value={values.achievementDate}
          onChange={(e) => update('achievementDate', e.target.value)}
        />
      </div>
      <div className="md:col-span-2">
        <Label htmlFor={`${idPrefix}-title`}>Title *</Label>
        <Input
          id={`${idPrefix}-title`}
          value={values.title}
          onChange={(e) => update('title', e.target.value)}
          placeholder="Publication title, award name, FDP topic…"
        />
      </div>
      <div className="md:col-span-2">
        <Label htmlFor={`${idPrefix}-desc`}>Description</Label>
        <textarea
          id={`${idPrefix}-desc`}
          className={`${selectClass} min-h-[64px] resize-y`}
          value={values.description}
          onChange={(e) => update('description', e.target.value)}
        />
      </div>
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
        >
          <option value="">— Optional —</option>
          {(metricsQ.data ?? []).map((m) => (
            <option key={m.id} value={m.code}>
              {m.code} — {m.title}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-year`}>Academic year *</Label>
        <Input
          id={`${idPrefix}-year`}
          value={values.academicYear}
          onChange={(e) => update('academicYear', e.target.value)}
        />
      </div>
    </div>
  );
}

export function buildAchievementFormData(
  file: File,
  values: AchievementFormValues,
  extra?: Record<string, string>,
): FormData {
  const form = new FormData();
  form.append('file', file);
  form.append('achievementType', values.achievementType);
  form.append('title', values.title.trim());
  form.append('criterion', String(values.criterion));
  form.append('academicYear', values.academicYear.trim());
  if (values.description.trim()) form.append('description', values.description.trim());
  if (values.achievementDate) form.append('achievementDate', values.achievementDate);
  if (values.metricCode) form.append('metricCode', values.metricCode);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v) form.append(k, v);
    }
  }
  return form;
}
