'use client';

import { erpInputCompact, erpSelectClass } from '@/components/erp/form-primitives';

export type StudentFilters = {
  search: string;
  programVersionId: string;
  shiftId: string;
  batchId: string;
  semester: string;
  streamId: string;
  admissionStatus: string;
  academicStatus: string;
};

type Props = {
  filters: StudentFilters;
  onChange: (patch: Partial<StudentFilters>) => void;
  programOptions: { id: string; label: string }[];
  shiftOptions: { id: string; label: string }[];
  batchOptions: { id: string; label: string }[];
  streamOptions: { id: string; label: string }[];
};

export function StudentFilterBar({
  filters,
  onChange,
  programOptions,
  shiftOptions,
  batchOptions,
  streamOptions,
}: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      <input
        className={`${erpInputCompact} min-w-[160px] flex-1`}
        placeholder="Search name, app/adm/reg no, roll, mobile, Aadhaar…"
        value={filters.search}
        onChange={(e) => onChange({ search: e.target.value })}
      />
      <select
        className={`${erpSelectClass} max-w-[180px]`}
        value={filters.programVersionId}
        onChange={(e) => onChange({ programVersionId: e.target.value })}
      >
        <option value="">All programmes</option>
        {programOptions.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        className={`${erpSelectClass} max-w-[140px]`}
        value={filters.batchId}
        onChange={(e) => onChange({ batchId: e.target.value })}
      >
        <option value="">All batches</option>
        {batchOptions.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        className={`${erpSelectClass} max-w-[120px]`}
        value={filters.semester}
        onChange={(e) => onChange({ semester: e.target.value })}
      >
        <option value="">All sem</option>
        {[1, 2, 3, 4, 5, 6].map((s) => (
          <option key={s} value={String(s)}>
            Sem {s}
          </option>
        ))}
      </select>
      <select
        className={`${erpSelectClass} max-w-[140px]`}
        value={filters.streamId}
        onChange={(e) => onChange({ streamId: e.target.value })}
      >
        <option value="">All streams</option>
        {streamOptions.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        className={`${erpSelectClass} max-w-[140px]`}
        value={filters.shiftId}
        onChange={(e) => onChange({ shiftId: e.target.value })}
      >
        <option value="">All shifts</option>
        {shiftOptions.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        className={`${erpSelectClass} max-w-[140px]`}
        value={filters.academicStatus}
        onChange={(e) => onChange({ academicStatus: e.target.value })}
      >
        <option value="">All status</option>
        {['Studying', 'Promoted', 'Alumni', 'Dropped'].map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  );
}
