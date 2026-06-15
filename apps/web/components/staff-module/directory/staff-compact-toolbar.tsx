'use client';

import Link from 'next/link';
import {
  ChevronDown,
  Download,
  Eye,
  FileSpreadsheet,
  MoreHorizontal,
  Plus,
  User,
} from 'lucide-react';

import { DirectorySearch } from '@/components/students-module/directory/directory-search';
import {
  countActiveStaffFilters,
  type StaffDirectoryFilters,
} from '@/components/staff-module/directory/staff-filter-utils';
import { STAFF_STATUSES, STAFF_TYPES } from '@/types/staff';
import { useSupportDataOptions } from '@/hooks/use-support-data';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { staffTypeLabel } from '@/components/staff-module/directory/staff-filter-utils';
import { TEACHING_SHIFT_FILTER_OPTIONS } from '@/components/staff-module/employment/staff-shift-category';
import { cn } from '@/utils/cn';

type Option = { id: string; label: string };

type FilterPillProps = {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
};

function FilterPill({ label, value, options, onChange }: FilterPillProps) {
  const active = Boolean(value);
  const selectedLabel = options.find((o) => o.id === value)?.label;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn(
            'h-7 rounded-full border-border/60 bg-background/60 px-2.5 text-[11px] font-medium',
            active && 'ring-1 ring-primary/40 shadow-[var(--shadow-glow)]',
          )}
        >
          {active ? (selectedLabel ?? label) : label}
          <ChevronDown className="ml-0.5 h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-64 w-48 overflow-y-auto p-1">
        <DropdownMenuItem className="text-xs" onClick={() => onChange('')}>
          All
        </DropdownMenuItem>
        {options.map((o) => (
          <DropdownMenuItem key={o.id} className="text-xs" onClick={() => onChange(o.id)}>
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type Props = {
  filters: StaffDirectoryFilters;
  totalCount?: number;
  search: string;
  onSearchChange: (value: string) => void;
  searchLoading?: boolean;
  onFilterChange: (patch: Partial<StaffDirectoryFilters>) => void;
  onResetFilters: () => void;
  departmentOptions: Option[];
  designationOptions: Option[];
  academicRoleOptions?: Option[];
  shiftOptions: Option[];
  canManage: boolean;
  canExport: boolean;
  canImport?: boolean;
  canBulkUpdate?: boolean;
  onDownloadTemplate?: () => void;
  selectedIds: Set<string>;
  onExport: () => void;
  onExportSelected?: () => void;
  exportPending?: boolean;
};

export function StaffCompactToolbar({
  filters,
  totalCount,
  search,
  onSearchChange,
  searchLoading,
  onFilterChange,
  onResetFilters,
  departmentOptions,
  designationOptions,
  academicRoleOptions = [],
  shiftOptions,
  canManage,
  canExport,
  canImport,
  canBulkUpdate,
  onDownloadTemplate,
  selectedIds,
  onExport,
  onExportSelected,
  exportPending,
}: Props) {
  const activeCount = countActiveStaffFilters(filters);
  const staffTypeData = useSupportDataOptions('staff-types');
  const statusData = useSupportDataOptions('staff-status');
  const staffTypeOptions =
    staffTypeData.options.length > 0
      ? staffTypeData.options.map((o) => ({ id: o.value, label: o.label }))
      : STAFF_TYPES.map((t) => ({ id: t, label: staffTypeLabel(t) }));
  const statusOptions =
    statusData.options.length > 0
      ? statusData.options.map((o) => ({ id: o.value, label: o.label }))
      : STAFF_STATUSES.map((s) => ({ id: s, label: staffTypeLabel(s) }));

  return (
    <div className="glass-card space-y-2 rounded-xl border border-border/50 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <DirectorySearch
          value={search}
          onChange={onSearchChange}
          loading={searchLoading}
          className="min-w-[180px] flex-1"
        />
        <FilterPill
          label="Type"
          value={filters.staffType}
          options={staffTypeOptions}
          onChange={(staffType) => onFilterChange({ staffType })}
        />
        <FilterPill
          label="Department"
          value={filters.departmentId}
          options={departmentOptions}
          onChange={(departmentId) => onFilterChange({ departmentId })}
        />
        <FilterPill
          label="Designation"
          value={filters.designationId}
          options={designationOptions}
          onChange={(designationId) => onFilterChange({ designationId })}
        />
        {academicRoleOptions.length > 0 ? (
          <FilterPill
            label="Role"
            value={filters.additionalRoleCode}
            options={academicRoleOptions}
            onChange={(additionalRoleCode) => onFilterChange({ additionalRoleCode })}
          />
        ) : null}
        <FilterPill
          label="Shift"
          value={filters.teachingShiftCategory}
          options={TEACHING_SHIFT_FILTER_OPTIONS.filter((o) => o.id).map((o) => ({
            id: o.id,
            label: o.label,
          }))}
          onChange={(teachingShiftCategory) => onFilterChange({ teachingShiftCategory })}
        />
        <FilterPill
          label="Status"
          value={filters.status}
          options={statusOptions}
          onChange={(status) => onFilterChange({ status })}
        />
        <FilterPill
          label="HoD"
          value={filters.uiHodOnly}
          options={[{ id: 'true', label: 'HoD only' }]}
          onChange={(uiHodOnly) => onFilterChange({ uiHodOnly })}
        />
        <FilterPill
          label="Teaching"
          value={filters.uiActiveTeaching}
          options={[{ id: 'true', label: 'Active teaching' }]}
          onChange={(uiActiveTeaching) => onFilterChange({ uiActiveTeaching })}
        />
        <FilterPill
          label="Research"
          value={filters.uiHasPublications}
          options={[{ id: 'true', label: 'Has publications' }]}
          onChange={(uiHasPublications) => onFilterChange({ uiHasPublications })}
        />
        {activeCount > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-[11px]"
            onClick={onResetFilters}
          >
            Clear ({activeCount})
          </Button>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {canExport ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px]"
                  disabled={exportPending}
                >
                  <Download className="mr-1 h-3.5 w-3.5" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="text-xs" onClick={onExport}>
                  Export all (filtered)
                </DropdownMenuItem>
                {onExportSelected && selectedIds.size > 0 ? (
                  <DropdownMenuItem className="text-xs" onClick={onExportSelected}>
                    Export selected ({selectedIds.size})
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          {canImport ? (
            <>
              <Link
                href="/admin/staff/import"
                className={cn(
                  buttonVariants({ size: 'sm', variant: 'outline' }),
                  'h-7 text-[11px]',
                )}
              >
                <FileSpreadsheet className="mr-1 h-3.5 w-3.5" />
                Import Staff
              </Link>
              {onDownloadTemplate ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px]"
                  onClick={onDownloadTemplate}
                >
                  <Download className="mr-1 h-3.5 w-3.5" />
                  Download Template
                </Button>
              ) : null}
            </>
          ) : null}
          {canBulkUpdate ? (
            <Link
              href="/admin/staff/bulk-update"
              className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'h-7 text-[11px]')}
            >
              <FileSpreadsheet className="mr-1 h-3.5 w-3.5" />
              Bulk Update
            </Link>
          ) : null}
          {canManage ? (
            <Link
              href="/admin/staff/new"
              className={cn(buttonVariants({ size: 'sm' }), 'h-7 text-[11px]')}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add Staff
            </Link>
          ) : null}
        </div>
      </div>
      {totalCount != null ? (
        <p className="text-[10px] text-muted-foreground">
          {totalCount.toLocaleString()} staff members
        </p>
      ) : null}
    </div>
  );
}
