'use client';

import { useApplicantCatalog } from '../hooks/use-applicant-catalog';
import { catalogOptionsForCategory } from '../utils';

const inputClass =
  'h-10 w-full rounded-lg border border-slate-200 bg-[#fefce8] px-3 text-sm text-slate-900 outline-none focus:border-[#2563eb]';

type Props = {
  values: Record<string, unknown>;
  onChange: (field: string, value: unknown) => void;
  readOnly?: boolean;
  programVersionId?: string | null;
  shifts?: { id: string; code: string; name: string }[];
  streamId?: string;
};

export function CoursePreferencesSection({
  values,
  onChange,
  readOnly,
  programVersionId,
  shifts = [],
  streamId,
}: Props) {
  const shiftId = String(values.shiftId ?? '');
  const majorCode = String(values.majorCode ?? '');

  const catalog = useApplicantCatalog({
    programVersionId,
    shiftId,
    streamId,
    majorCode,
    enabled: Boolean(programVersionId && shiftId),
  });

  const fields = [
    { key: 'majorCode', label: 'Major subject', category: 'MAJOR', options: catalog.majorOptions },
    { key: 'minorCode', label: 'Minor subject', category: 'MINOR', options: catalog.minorOptions },
    { key: 'mdcCode', label: 'MDC', category: 'MDC', options: catalog.mdcOptions },
    { key: 'aecCode', label: 'AEC', category: 'AEC', options: catalog.aecOptions },
    { key: 'secCode', label: 'SEC', category: 'SEC', options: catalog.secOptions },
    { key: 'vacCode', label: 'VAC', category: 'VAC', options: catalog.vacOptions },
  ] as const;

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
        Once submitted, you cannot change your course selections.
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Preferred Shift *</span>
          <select
            className={inputClass}
            disabled={readOnly}
            value={shiftId}
            onChange={(e) => onChange('shiftId', e.target.value)}
          >
            <option value="">Select shift</option>
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
        </label>

        {!shiftId ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Choose a shift to load available subjects.
          </p>
        ) : null}

        <p className="mt-4 text-xs text-slate-500">
          Options show as <strong>CODE — Name</strong>. Minor subjects depend on your selected
          Major.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {fields.map(({ key, label, category, options }) => {
            const dropdown = catalogOptionsForCategory(options, category);
            return (
              <label key={key} className="block space-y-1.5">
                <span className="text-sm font-medium text-slate-700">{label} *</span>
                <select
                  className={inputClass}
                  disabled={readOnly || !shiftId || catalog.isLoading}
                  value={String(values[key] ?? '')}
                  onChange={(e) => onChange(key, e.target.value)}
                >
                  <option value="">
                    {catalog.isLoading ? 'Loading…' : `Select ${label.toLowerCase()}`}
                  </option>
                  {dropdown.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>

        {majorCode ? (
          <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">
            Your selection: Shift: {shifts.find((s) => s.id === shiftId)?.name ?? '—'} | Major:{' '}
            {majorCode}
            {values.minorCode ? ` | Minor: ${String(values.minorCode)}` : ''}
          </div>
        ) : null}
      </div>
    </div>
  );
}
