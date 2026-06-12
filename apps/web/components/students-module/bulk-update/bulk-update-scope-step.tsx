'use client';

import { DirectoryFilterChips } from '@/components/students-module/directory/directory-filter-chips';
import type { DirectoryFilters } from '@/components/students-module/directory/directory-filter-bar';
import {
  countActiveFilters,
  optionsToMap,
  type FilterOptionMaps,
} from '@/components/students-module/directory/directory-utils';
import { cn } from '@/utils/cn';
import { FileSpreadsheet, Search, Users } from 'lucide-react';

type Option = { id: string; label: string };

type Props = {
  scopeMode: 'selection' | 'filters';
  onScopeModeChange: (mode: 'selection' | 'filters') => void;
  filters: DirectoryFilters;
  onFilterChange: (patch: Partial<DirectoryFilters>) => void;
  onOpenAdvanced: () => void;
  totalFound?: number;
  selectedCount: number;
  programOptions: Option[];
  batchOptions: Option[];
  shiftOptions: Option[];
  streamOptions: Option[];
  departmentOptions: Option[];
  sessionOptions: Option[];
  categoryOptions: Option[];
  religionOptions: Option[];
};

export function BulkUpdateScopeStep({
  scopeMode,
  onScopeModeChange,
  filters,
  onFilterChange,
  onOpenAdvanced,
  totalFound,
  selectedCount,
  programOptions,
  batchOptions,
  shiftOptions,
  streamOptions,
  departmentOptions,
  sessionOptions,
  categoryOptions,
  religionOptions,
}: Props) {
  const optionMaps: FilterOptionMaps = {
    program: optionsToMap(programOptions),
    batch: optionsToMap(batchOptions),
    shift: optionsToMap(shiftOptions),
    stream: optionsToMap(streamOptions),
    department: optionsToMap(departmentOptions),
    session: optionsToMap(sessionOptions),
    category: optionsToMap(categoryOptions),
    religion: optionsToMap(religionOptions),
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Define Scope</h2>
        <p className="text-xs text-muted-foreground">
          Choose how to target students before selecting fields and committing a controlled
          operation.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {[
          {
            mode: 'selection' as const,
            title: 'Manual Selection',
            subtitle: 'Select individual students using the directory workflow.',
            icon: <Users className="h-5 w-5" />,
          },
          {
            mode: 'filters' as const,
            title: 'Filter Mode',
            subtitle: 'Target students by programme, semester, batch, shift, and status.',
            icon: <Search className="h-5 w-5" />,
          },
        ].map((option) => (
          <button
            key={option.mode}
            type="button"
            className={cn(
              'rounded-3xl border p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md',
              scopeMode === option.mode
                ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/25'
                : 'border-border bg-background/70 hover:border-primary/30',
            )}
            onClick={() => onScopeModeChange(option.mode)}
          >
            <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              {option.icon}
            </span>
            <span className="block text-sm font-semibold">{option.title}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{option.subtitle}</span>
          </button>
        ))}
        <button
          type="button"
          className="rounded-3xl border border-dashed border-border bg-background/50 p-4 text-left opacity-75 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
          onClick={onOpenAdvanced}
        >
          <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <FileSpreadsheet className="h-5 w-5" />
          </span>
          <span className="block text-sm font-semibold">Import Scope</span>
          <span className="mt-1 block text-xs text-muted-foreground">
            Advanced: upload a student list for targeted operations.
          </span>
        </button>
      </div>

      {scopeMode === 'selection' ? (
        <div className="rounded-3xl border border-border/60 bg-muted/20 px-4 py-3 text-sm">
          {selectedCount > 0 ? (
            <p>
              <span className="font-semibold text-primary">{selectedCount}</span> students
              pre-selected from the directory.
            </p>
          ) : (
            <p className="text-muted-foreground">
              No students selected yet. Continue to the Select step to pick students, or switch to
              filter mode.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3 rounded-3xl border border-border/60 bg-background/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Intelligent Scope Builder</h3>
              <p className="text-xs text-muted-foreground">
                Use basic filters here and open advanced filters for category, session, admission,
                and profile targeting.
              </p>
            </div>
            {totalFound != null ? (
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                Students Matching: {totalFound.toLocaleString()}
              </span>
            ) : null}
          </div>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            <select
              className="rounded-2xl border border-border bg-background px-3 py-2 text-xs"
              value={filters.programVersionId}
              onChange={(e) => onFilterChange({ programVersionId: e.target.value })}
            >
              <option value="">All programmes</option>
              {programOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              className="rounded-2xl border border-border bg-background px-3 py-2 text-xs"
              value={filters.batchId}
              onChange={(e) => onFilterChange({ batchId: e.target.value })}
            >
              <option value="">All batches</option>
              {batchOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              className="rounded-2xl border border-border bg-background px-3 py-2 text-xs"
              value={filters.shiftId}
              onChange={(e) => onFilterChange({ shiftId: e.target.value })}
            >
              <option value="">All shifts</option>
              {shiftOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              className="rounded-2xl border border-border bg-background px-3 py-2 text-xs"
              value={filters.semester}
              onChange={(e) => onFilterChange({ semester: e.target.value })}
            >
              <option value="">All semesters</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                <option key={s} value={String(s)}>
                  Sem {s}
                </option>
              ))}
            </select>
            <select
              className="rounded-2xl border border-border bg-background px-3 py-2 text-xs"
              value={filters.studentStatus}
              onChange={(e) => onFilterChange({ studentStatus: e.target.value })}
            >
              <option value="">All statuses</option>
              <option value="STUDYING">Studying</option>
              <option value="ALUMNI">Alumni</option>
              <option value="DETAINED">Detained</option>
            </select>
            <button
              type="button"
              className="rounded-2xl border border-border px-3 py-2 text-xs transition hover:-translate-y-0.5 hover:bg-muted hover:shadow-sm"
              onClick={onOpenAdvanced}
            >
              Advanced filters ({countActiveFilters(filters)})
            </button>
          </div>
          <DirectoryFilterChips
            filters={filters}
            optionMaps={optionMaps}
            onRemove={(key) => onFilterChange({ [key]: '' })}
            onClearAll={() =>
              onFilterChange({
                search: '',
                programVersionId: '',
                batchId: '',
                shiftId: '',
                semester: '',
                streamId: '',
                departmentId: '',
                sessionId: '',
                categoryLookupId: '',
                religionLookupId: '',
                differentlyAbled: '',
                studentStatus: '',
                admissionType: '',
                admissionStatus: '',
                academicStatus: '',
              })
            }
          />
        </div>
      )}
    </div>
  );
}
