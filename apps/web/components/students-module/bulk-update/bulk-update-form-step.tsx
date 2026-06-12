'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { SpreadsheetDropzone } from '@/components/erp/bulk-actions';
import { erpSelectClass } from '@/components/erp/form-primitives';
import type { BulkUpdateFieldDef } from '@/services/student-bulk-update';
import { fetchAdmissionBatches } from '@/services/academic-lifecycle';
import { fetchAcademicStreams, fetchCatalog } from '@/services/academic-engine';
import { fetchPrograms } from '@/services/programs';
import { fetchShifts } from '@/services/shifts';
import { fetchMasterLookups } from '@/services/students';
import { parseBulkUpdateCsv } from '@/services/student-bulk-update';
import { cn } from '@/utils/cn';

type Props = {
  fields: BulkUpdateFieldDef[];
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  updateMode: 'REPLACE' | 'APPEND' | 'CSV';
  onUpdateModeChange: (mode: 'REPLACE' | 'APPEND' | 'CSV') => void;
  csvRows: Record<string, string>[];
  onCsvRowsChange: (rows: Record<string, string>[]) => void;
  allowVtcOverride: boolean;
  onAllowVtcOverrideChange: (v: boolean) => void;
  institutionId?: string;
  campusId?: string;
  defaultProgramVersionId?: string;
};

const GENDER_OPTIONS = ['MALE', 'FEMALE', 'OTHER'];
const STATUS_OPTIONS = ['STUDYING', 'ALUMNI', 'LEAVING', 'DETAINED', 'DROPPED'];
const ADMISSION_STATUS_OPTIONS = ['ADMITTED', 'PROVISIONAL', 'CANCELLED'];

export function BulkUpdateFormStep({
  fields,
  values,
  onChange,
  updateMode,
  onUpdateModeChange,
  csvRows,
  onCsvRowsChange,
  allowVtcOverride,
  onAllowVtcOverrideChange,
  institutionId,
  campusId,
  defaultProgramVersionId,
}: Props) {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const hasAppendFields = fields.some((f) => f.supportsAppend);
  const hasVtc = fields.some((f) => f.fieldKey === 'VTC');
  const hasNep = fields.some((f) => f.permission === 'subjects');

  const programs = useQuery({
    queryKey: ['programs', 'bulk-update'],
    queryFn: () => fetchPrograms(1),
  });
  const programVersions = useMemo(() => {
    const rows: { id: string; label: string }[] = [];
    for (const p of programs.data?.data ?? []) {
      for (const v of p.versions ?? []) {
        rows.push({ id: v.id, label: `${p.code} v${v.version}` });
      }
    }
    return rows;
  }, [programs.data]);

  const pvId = String(values.programVersionId ?? defaultProgramVersionId ?? '');

  const batches = useQuery({
    queryKey: ['batches', institutionId],
    queryFn: () => fetchAdmissionBatches(institutionId!),
    enabled: Boolean(institutionId),
  });
  const shifts = useQuery({
    queryKey: ['shifts', campusId],
    queryFn: () => fetchShifts({ campusId, status: 'ACTIVE' }),
    enabled: Boolean(campusId),
  });
  const streams = useQuery({
    queryKey: ['streams'],
    queryFn: () => fetchAcademicStreams(),
  });

  const lookupQueries = {
    BLOOD_GROUP: useQuery({
      queryKey: ['lookups', 'BLOOD_GROUP'],
      queryFn: () => fetchMasterLookups('BLOOD_GROUP'),
    }),
    RESERVATION_CATEGORY: useQuery({
      queryKey: ['lookups', 'CATEGORY'],
      queryFn: () => fetchMasterLookups('CATEGORY'),
    }),
    RELIGION: useQuery({
      queryKey: ['lookups', 'RELIGION'],
      queryFn: () => fetchMasterLookups('RELIGION'),
    }),
    TRIBE: useQuery({
      queryKey: ['lookups', 'TRIBE'],
      queryFn: () => fetchMasterLookups('TRIBE'),
    }),
  };

  const nepCatalog = useQuery({
    queryKey: ['bulk-update', 'nep-catalog', pvId, fields.map((f) => f.fieldKey).join(',')],
    queryFn: async () => {
      const out: Record<string, { id: string; label: string }[]> = {};
      for (const field of fields.filter((f) => f.inputType === 'subject' && f.nepCategory)) {
        const rows = await fetchCatalog({
          programVersionId: pvId,
          semesterSequence: 1,
          category: field.nepCategory,
        });
        const list = Array.isArray(rows) ? rows : (rows.eligible ?? []);
        out[field.fieldKey] = list.map((section) => ({
          id: section.courseOffering?.id ?? section.id,
          label:
            `${section.courseOffering?.course?.code ?? ''} ${section.courseOffering?.course?.title ?? section.sectionCode}`.trim(),
        }));
      }
      return out;
    },
    enabled: Boolean(pvId) && hasNep,
  });

  const setValue = (key: string, value: unknown) => {
    onChange({ ...values, [key]: value });
  };

  const onCsvFile = async (file: File) => {
    setCsvFile(file);
    const text = await file.text();
    onCsvRowsChange(parseBulkUpdateCsv(text));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Configure Values Studio</h2>
          <p className="text-xs text-muted-foreground">
            Generate controlled new-value panels with validation hints before preview.
          </p>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          {fields.length} field{fields.length === 1 ? '' : 's'} configured
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {(['REPLACE', 'APPEND', 'CSV'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            disabled={mode === 'APPEND' && !hasAppendFields}
            className={cn(
              'rounded-3xl border p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40',
              updateMode === mode
                ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/25'
                : 'border-border bg-background/70 hover:border-primary/30',
            )}
            onClick={() => onUpdateModeChange(mode)}
          >
            <span className="text-sm font-semibold">
              {mode === 'REPLACE'
                ? 'Bulk Replace'
                : mode === 'APPEND'
                  ? 'Append Rules'
                  : 'Individual CSV'}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {mode === 'REPLACE'
                ? 'Apply the same validated value to all selected students.'
                : mode === 'APPEND'
                  ? 'Append to compatible text fields without deleting existing data.'
                  : 'Upload row-specific values using enrollment or roll number.'}
            </span>
          </button>
        ))}
      </div>

      {updateMode === 'CSV' ? (
        <div className="space-y-3">
          <SpreadsheetDropzone
            file={csvFile}
            accept=".csv,text/csv"
            title="Drag & Drop Bulk Update CSV"
            subtitle="or click to browse a CSV with RollNumber or EnrollmentNumber"
            supportedText="CSV"
            onFile={(file) => void onCsvFile(file)}
            onRemove={() => {
              setCsvFile(null);
              onCsvRowsChange([]);
            }}
          />
          {csvRows.length > 0 ? (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
              {csvRows.length} rows parsed and ready for preview.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {fields.map((field) => (
            <div
              key={field.fieldKey}
              className="space-y-2 rounded-3xl border border-border/60 bg-background/60 p-4"
            >
              <label className="text-xs font-medium">{field.label}</label>
              {renderFieldInput(field, values[field.fieldKey], setValue, {
                programVersions,
                batches: batches.data ?? [],
                shifts: shifts.data ?? [],
                streams: streams.data ?? [],
                lookups: lookupQueries,
                nepOptions: nepCatalog.data?.[field.fieldKey] ?? [],
              })}
            </div>
          ))}
        </div>
      )}

      {hasVtc ? (
        <label className="flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
          <input
            type="checkbox"
            checked={allowVtcOverride}
            onChange={(e) => onAllowVtcOverrideChange(e.target.checked)}
          />
          Allow VTC track override in semester 4/6
        </label>
      ) : null}
    </div>
  );
}

function renderFieldInput(
  field: BulkUpdateFieldDef,
  value: unknown,
  setValue: (key: string, value: unknown) => void,
  opts: {
    programVersions: { id: string; label: string }[];
    batches: { id: string; batchCode: string; admissionYear: number }[];
    shifts: { id: string; name: string }[];
    streams: { id: string; name: string }[];
    lookups: Record<string, { data?: { id: string; label: string }[] }>;
    nepOptions: { id: string; label: string }[];
  },
) {
  const strVal = value == null ? '' : String(value);

  if (field.inputType === 'boolean') {
    return (
      <select
        className={erpSelectClass}
        value={strVal}
        onChange={(e) => setValue(field.fieldKey, e.target.value === 'true')}
      >
        <option value="">— leave unchanged —</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }

  if (field.fieldKey === 'gender') {
    return (
      <select
        className={erpSelectClass}
        value={strVal}
        onChange={(e) => setValue(field.fieldKey, e.target.value)}
      >
        <option value="">— leave unchanged —</option>
        {GENDER_OPTIONS.map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </select>
    );
  }

  if (field.fieldKey === 'studentStatus') {
    return (
      <select
        className={erpSelectClass}
        value={strVal}
        onChange={(e) => setValue(field.fieldKey, e.target.value)}
      >
        <option value="">— leave unchanged —</option>
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    );
  }

  if (field.fieldKey === 'admissionStatus') {
    return (
      <select
        className={erpSelectClass}
        value={strVal}
        onChange={(e) => setValue(field.fieldKey, e.target.value)}
      >
        <option value="">— leave unchanged —</option>
        {ADMISSION_STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    );
  }

  if (field.fieldKey === 'programVersionId') {
    return (
      <select
        className={erpSelectClass}
        value={strVal}
        onChange={(e) => setValue(field.fieldKey, e.target.value)}
      >
        <option value="">— leave unchanged —</option>
        {opts.programVersions.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.fieldKey === 'admissionBatchId') {
    return (
      <select
        className={erpSelectClass}
        value={strVal}
        onChange={(e) => setValue(field.fieldKey, e.target.value)}
      >
        <option value="">— leave unchanged —</option>
        {opts.batches.map((b) => (
          <option key={b.id} value={b.id}>
            {`${b.batchCode} (${b.admissionYear})`}
          </option>
        ))}
      </select>
    );
  }

  if (field.fieldKey === 'primaryShiftId') {
    return (
      <select
        className={erpSelectClass}
        value={strVal}
        onChange={(e) => setValue(field.fieldKey, e.target.value)}
      >
        <option value="">— leave unchanged —</option>
        {opts.shifts.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    );
  }

  if (field.fieldKey === 'streamId') {
    return (
      <select
        className={erpSelectClass}
        value={strVal}
        onChange={(e) => setValue(field.fieldKey, e.target.value)}
      >
        <option value="">— leave unchanged —</option>
        {opts.streams.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    );
  }

  if (field.inputType === 'lookup' && field.lookupType) {
    const rows = opts.lookups[field.lookupType]?.data ?? [];
    return (
      <select
        className={erpSelectClass}
        value={strVal}
        onChange={(e) => setValue(field.fieldKey, e.target.value)}
      >
        <option value="">— leave unchanged —</option>
        {rows.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.inputType === 'subject') {
    return (
      <select
        className={erpSelectClass}
        value={strVal}
        onChange={(e) => setValue(field.fieldKey, e.target.value)}
      >
        <option value="">— leave unchanged —</option>
        {opts.nepOptions.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.inputType === 'textarea') {
    return (
      <textarea
        className="min-h-[72px] w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
        value={strVal}
        onChange={(e) => setValue(field.fieldKey, e.target.value)}
        placeholder="New value for all students"
      />
    );
  }

  return (
    <input
      type={field.inputType === 'date' ? 'date' : 'text'}
      className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
      value={strVal}
      onChange={(e) => setValue(field.fieldKey, e.target.value)}
      placeholder="New value for all students"
    />
  );
}
