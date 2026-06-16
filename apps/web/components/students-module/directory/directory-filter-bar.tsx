'use client';

import { erpSelectClass } from '@/components/erp/form-primitives';
import type { StudentFilters } from '@/components/student-records/student-filter-bar';
import { useSupportDataOptions } from '@/hooks/use-support-data';

export type DirectoryFilters = StudentFilters & {
  departmentId: string;
  sessionId: string;
  categoryLookupId: string;
  religionLookupId: string;
  differentlyAbled: string;
  studentStatus: string;
  admissionType: string;
  /** UI-only until dedicated backend filters exist */
  uiSubjectPending?: string;
  uiFeeDue?: string;
  uiHostel?: string;
  uiRfidAssigned?: string;
  uiAttendanceShortage?: string;
  uiRecentlyAdded?: string;
  uiNoPhoto?: string;
  uiNoMobile?: string;
  uiAbcStatus?: string;
};

type Props = {
  filters: DirectoryFilters;
  onChange: (patch: Partial<DirectoryFilters>) => void;
  programOptions: { id: string; label: string }[];
  shiftOptions: { id: string; label: string }[];
  batchOptions: { id: string; label: string }[];
  streamOptions: { id: string; label: string }[];
  departmentOptions: { id: string; label: string }[];
  sessionOptions: { id: string; label: string }[];
  categoryOptions: { id: string; label: string }[];
};

const FALLBACK_STUDENT_STATUSES = ['STUDYING', 'ALUMNI', 'LEAVING', 'DETAINED', 'DROPPED'] as const;
const FALLBACK_ADMISSION_TYPES = ['REGULAR', 'LATERAL', 'MIGRATION', 'RE_ADMISSION'] as const;

export function DirectoryFilterBar({
  filters,
  onChange,
  programOptions,
  shiftOptions,
  batchOptions,
  streamOptions,
  departmentOptions,
  sessionOptions,
  categoryOptions,
}: Props) {
  const studentStatusData = useSupportDataOptions('student-status');
  const admissionTypeData = useSupportDataOptions('admission-types');
  const studentStatuses =
    studentStatusData.options.length > 0
      ? studentStatusData.options.map((o) => o.value)
      : [...FALLBACK_STUDENT_STATUSES];
  const admissionTypes =
    admissionTypeData.options.length > 0
      ? admissionTypeData.options.map((o) => o.value)
      : [...FALLBACK_ADMISSION_TYPES];

  return (
    <div className="flex flex-wrap gap-2">
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
        className={`${erpSelectClass} max-w-[140px]`}
        value={filters.sessionId}
        onChange={(e) => onChange({ sessionId: e.target.value })}
      >
        <option value="">All sessions</option>
        {sessionOptions.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        className={`${erpSelectClass} max-w-[100px]`}
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
        value={filters.categoryLookupId}
        onChange={(e) => onChange({ categoryLookupId: e.target.value })}
      >
        <option value="">All categories</option>
        {categoryOptions.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        className={`${erpSelectClass} max-w-[130px]`}
        value={filters.studentStatus}
        onChange={(e) => onChange({ studentStatus: e.target.value })}
      >
        <option value="">Student status</option>
        {studentStatuses.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <select
        className={`${erpSelectClass} max-w-[130px]`}
        value={filters.admissionType}
        onChange={(e) => onChange({ admissionType: e.target.value })}
      >
        <option value="">Admission type</option>
        {admissionTypes.map((s) => (
          <option key={s} value={s}>
            {s.replace(/_/g, ' ')}
          </option>
        ))}
      </select>
      <select
        className={`${erpSelectClass} max-w-[140px]`}
        value={filters.academicStatus}
        onChange={(e) => onChange({ academicStatus: e.target.value })}
      >
        <option value="">Academic status</option>
        {['Studying', 'Promoted', 'Alumni', 'Dropped'].map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  );
}
