'use client';

import { erpSelectClass } from '@/components/erp/form-primitives';
import type { StudentReportFilters } from '@/services/student-reports';

export type StudentReportFilterState = {
  programVersionId: string;
  shiftId: string;
  batchId: string;
  semester: string;
  streamId: string;
  departmentId: string;
  admissionStatus: string;
  studentStatus: string;
};

export const emptyReportFilters: StudentReportFilterState = {
  programVersionId: '',
  shiftId: '',
  batchId: '',
  semester: '',
  streamId: '',
  departmentId: '',
  admissionStatus: '',
  studentStatus: '',
};

export function toApiFilters(state: StudentReportFilterState): StudentReportFilters {
  const opt = (v: string) => v || undefined;
  return {
    programVersionId: opt(state.programVersionId),
    shiftId: opt(state.shiftId),
    batchId: opt(state.batchId),
    streamId: opt(state.streamId),
    departmentId: opt(state.departmentId),
    admissionStatus: opt(state.admissionStatus),
    studentStatus: opt(state.studentStatus),
    semester: state.semester ? Number(state.semester) : undefined,
  };
}

type Props = {
  filters: StudentReportFilterState;
  onChange: (patch: Partial<StudentReportFilterState>) => void;
  programOptions: { id: string; label: string }[];
  shiftOptions: { id: string; label: string }[];
  batchOptions: { id: string; label: string }[];
  streamOptions: { id: string; label: string }[];
  departmentOptions?: { id: string; label: string }[];
};

export function StudentReportFiltersBar({
  filters,
  onChange,
  programOptions,
  shiftOptions,
  batchOptions,
  streamOptions,
  departmentOptions = [],
}: Props) {
  return (
    <div className="flex flex-wrap gap-2 rounded-xl border border-border/60 bg-card/80 p-3 print:hidden">
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
      {departmentOptions.length > 0 ? (
        <select
          className={`${erpSelectClass} max-w-[160px]`}
          value={filters.departmentId}
          onChange={(e) => onChange({ departmentId: e.target.value })}
        >
          <option value="">All departments</option>
          {departmentOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      ) : null}
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
        className={`${erpSelectClass} max-w-[130px]`}
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
        className={`${erpSelectClass} max-w-[130px]`}
        value={filters.admissionStatus}
        onChange={(e) => onChange({ admissionStatus: e.target.value })}
      >
        <option value="">All admission</option>
        <option value="ACTIVE">Active</option>
        <option value="PROVISIONAL">Provisional</option>
        <option value="CANCELLED">Cancelled</option>
      </select>
      <select
        className={`${erpSelectClass} max-w-[130px]`}
        value={filters.studentStatus}
        onChange={(e) => onChange({ studentStatus: e.target.value })}
      >
        <option value="">All status</option>
        <option value="STUDYING">Studying</option>
        <option value="ACTIVE">Active</option>
        <option value="PASSED_OUT">Passed Out</option>
        <option value="DROPOUT">Dropout</option>
      </select>
    </div>
  );
}
