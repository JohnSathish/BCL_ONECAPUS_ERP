'use client';

import { erpSelectClass } from '@/components/erp/form-primitives';
import type { CompletionFilters } from '@/types/curriculum-completion';

type Option = { id: string; label: string };

type Props = {
  filters: CompletionFilters;
  onChange: (patch: Partial<CompletionFilters>) => void;
  onReset: () => void;
  institutionOptions: Option[];
  programmeOptions: Option[];
  departmentOptions: Option[];
  batchOptions: Option[];
  highlightedSemester?: number | null;
};

const selectClass = `${erpSelectClass} max-w-full text-xs`;

export function CompletionFilterBar({
  filters,
  onChange,
  onReset,
  institutionOptions,
  programmeOptions,
  departmentOptions,
  batchOptions,
  highlightedSemester,
}: Props) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-muted-foreground">Institution</span>
        <select
          className={`${selectClass} min-w-[140px]`}
          value={filters.institutionId}
          onChange={(e) => onChange({ institutionId: e.target.value, batchId: '' })}
        >
          <option value="">Default institution</option>
          {institutionOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-muted-foreground">Programme</span>
        <select
          className={`${selectClass} min-w-[160px]`}
          value={filters.programVersionId}
          onChange={(e) => onChange({ programVersionId: e.target.value })}
        >
          <option value="">All programmes</option>
          {programmeOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-muted-foreground">Department</span>
        <select
          className={`${selectClass} min-w-[140px]`}
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
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-muted-foreground">Semester</span>
        <select
          className={`${selectClass} min-w-[100px]`}
          value={filters.semesterSequence}
          onChange={(e) => onChange({ semesterSequence: e.target.value })}
        >
          <option value="">All semesters</option>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
            <option key={sem} value={String(sem)}>
              Sem {sem}
              {highlightedSemester === sem ? ' (batch)' : ''}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-muted-foreground">Version</span>
        <select
          className={`${selectClass} min-w-[120px]`}
          value={filters.versionStatus}
          onChange={(e) => onChange({ versionStatus: e.target.value })}
        >
          <option value="ALL">All versions</option>
          <option value="ACTIVE">Active only</option>
          <option value="DRAFT">Draft</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-muted-foreground">Batch</span>
        <select
          className={`${selectClass} min-w-[120px]`}
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
      </label>
      <button
        type="button"
        className="h-8 rounded-md border border-border px-3 text-xs hover:bg-muted"
        onClick={onReset}
      >
        Reset
      </button>
    </div>
  );
}
